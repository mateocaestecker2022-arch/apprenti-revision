import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

const ETAPES_LABELS = ['', 'Faits pertinents', 'Problème de droit', 'Règle applicable', 'Application au cas', 'Conclusion']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const exercice = await prisma.exerciceGuide.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!exercice) return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })
  if (exercice.termine) return NextResponse.json({ error: 'Exercice déjà terminé' }, { status: 400 })

  const body = await req.json()
  const reponse = typeof body.reponse === 'string' ? body.reponse.trim() : ''
  if (!reponse) return NextResponse.json({ error: 'Réponse requise' }, { status: 400 })

  const course = await prisma.course.findFirst({
    where: { id: exercice.courseId },
    select: { niveau: true, rawContent: true },
  })
  const niveau = (course as { niveau?: string })?.niveau || 'L1'
  const niveauInstruction = getNiveauInstruction(niveau)

  const chunks = await retrieveChunks(exercice.courseId, reponse.slice(0, 200), 4)
  const ragContext = chunks.length > 0 ? chunks.join('\n\n') : (course?.rawContent || '').slice(0, 2000)

  const historique = exercice.historique as Array<{ role: string; content: string }>
  const updatedHistorique = [
    ...historique,
    { role: 'user', content: reponse },
  ]

  const isCopie = exercice.type === 'copie_td'
  const nbEchanges = updatedHistorique.filter(h => h.role === 'user').length

  const prompt = isCopie
    ? `Tu es un chargé de TD de droit. Tu aides un étudiant à améliorer sa copie par questionnement socratique.

RÈGLES ABSOLUES :
- Ne donne JAMAIS la réponse directement
- Pose une seule question à la fois, ciblée
- Si l'étudiant a compris un point, valide brièvement et passe au suivant
- Référence UNIQUEMENT les notions du cours ci-dessous
- Après ${Math.max(5, nbEchanges)} échanges et que les points essentiels sont traités, tu peux conclure

${niveauInstruction}

EXTRAITS DU COURS (références autorisées) :
${ragContext}

COPIE ORIGINALE DE L'ÉTUDIANT :
${exercice.enonce}

HISTORIQUE DU DIALOGUE :
${JSON.stringify(updatedHistorique)}

DERNIÈRE RÉPONSE : ${reponse}

Génère en JSON strict. "termine" est true uniquement si les points essentiels ont été traités ET que tu as posé au moins 4 questions :
{
  "feedback": "Réaction bienveillante à la réponse",
  "valide": true,
  "questionSuivante": "Prochaine question ou null si termine",
  "termine": false,
  "recapitulatif": null
}`
    : `Tu es un professeur de droit qui guide un étudiant pas à pas sur un cas pratique.

RÈGLES STRICTES :
- Ne donne JAMAIS la réponse directement
- Si la réponse est correcte : valide brièvement (1-2 phrases) et pose la prochaine question
- Si la réponse est incorrecte : indique l'erreur SANS corriger (laisse réessayer)
- Une seule question à la fois
- Étape actuelle : ${exercice.etapeActuelle}/5 (${ETAPES_LABELS[exercice.etapeActuelle] || ''})

ÉTAPES DU SYLLOGISME :
1. Faits pertinents
2. Problème de droit
3. Règle applicable (UNIQUEMENT depuis le cours ci-dessous)
4. Application au cas
5. Conclusion

${niveauInstruction}

RÉFÉRENCES DU COURS (règles autorisées) :
${ragContext}

ÉNONCÉ : ${exercice.enonce}

HISTORIQUE :
${JSON.stringify(updatedHistorique)}

DERNIÈRE RÉPONSE DE L'ÉTUDIANT : ${reponse}

Génère en JSON strict. Si les 5 étapes sont validées, "termine" est true et "recapitulatif" contient un résumé complet :
{
  "feedback": "Réaction à la réponse de l'étudiant",
  "valide": true,
  "questionSuivante": "Prochaine question ou null si termine",
  "etapeSuivante": ${exercice.etapeActuelle},
  "termine": false,
  "recapitulatif": null
}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON')
      const data = JSON.parse(match[0])
      if (typeof data.feedback !== 'string') throw new Error('JSON invalide')

      const etapeSuivante = isCopie
        ? exercice.etapeActuelle
        : (data.valide ? Math.min((exercice.etapeActuelle + 1), 5) : exercice.etapeActuelle)
      const termine = data.termine === true || (!isCopie && etapeSuivante >= 5 && data.valide === true)

      const newHistorique = [
        ...updatedHistorique,
        { role: 'assistant', content: data.feedback + (data.questionSuivante ? '\n\n' + data.questionSuivante : '') },
      ]

      await prisma.exerciceGuide.update({
        where: { id: params.id },
        data: {
          historique: newHistorique,
          etapeActuelle: termine ? 5 : etapeSuivante,
          termine,
        },
      })

      return NextResponse.json({
        feedback: data.feedback,
        valide: data.valide,
        questionSuivante: termine ? null : data.questionSuivante,
        etapeActuelle: termine ? 5 : etapeSuivante,
        termine,
        recapitulatif: termine ? (data.recapitulatif || null) : null,
      })
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      console.error('[STEP] Erreur:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}
