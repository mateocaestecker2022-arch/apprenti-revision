import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

const DIFFICULTE_INSTRUCTION: Record<string, string> = {
  facile: `DIFFICULTÉ FACILE : Questions de définition, identification et restitution directe. L'étudiant retrouve et formule une notion ou règle du cours. Pas de qualification complexe exigée.`,
  intermediaire: `DIFFICULTÉ INTERMÉDIAIRE : Questions de qualification et d'application à une situation simple. L'étudiant mobilise la règle et l'applique à un cas concret tiré du cours.`,
  avance: `DIFFICULTÉ AVANCÉE : Questions d'analyse, de distinction et de nuance. L'étudiant argumente, compare des mécanismes et fait preuve d'esprit critique. Les réponses approximatives sont insuffisantes.`,
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await fn() } catch (err) {
      if ((err as { status?: number })?.status === 429) throw err
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      throw err
    }
  }
  throw new Error('Max retries')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { rawContent: true, niveau: true },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  // ── GÉNÉRATION DES QUESTIONS ──────────────────────────────────────────────
  if (action === 'generate') {
    const difficulte = ['facile', 'intermediaire', 'avance'].includes(body.difficulte)
      ? (body.difficulte as string)
      : 'intermediaire'
    const niveau = (body.niveau as string) || course.niveau || 'L1'

    const chunks = await retrieveChunks(params.id, 'notion définition règle applicable mécanisme', 8)
    const ragContext = chunks.length > 0 ? chunks.join('\n\n') : course.rawContent.slice(0, 5000)

    const prompt = `Tu es un chargé de TD de droit. Génère 5 questions de TD originales et variées, basées UNIQUEMENT sur les extraits du cours ci-dessous.

RÈGLE ABSOLUE ANTI-INVENTION : chaque question doit porter exclusivement sur une notion, règle ou mécanisme PRÉSENT dans ces extraits. N'invente aucun article, arrêt ou jurisprudence absent du cours.

${getNiveauInstruction(niveau)}
${DIFFICULTE_INSTRUCTION[difficulte]}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict — 5 questions variées (pas toutes des définitions) :
{
  "questions": [
    {
      "question": "Texte complet de la question, formulé comme un vrai TD",
      "pointMethode": "Ce qu'on attend méthodologiquement dans une bonne réponse",
      "notionCle": "La notion principale du cours sur laquelle porte la question"
    }
  ],
  "avertissement": "${AI_WARNING}"
}`

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2500,
          temperature: 0.5,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error('JSON invalide')
        return parsed
      })
      return NextResponse.json(data)
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      console.error('[QUESTIONS-TD] generate:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  // ── FEEDBACK SUR UNE RÉPONSE ──────────────────────────────────────────────
  if (action === 'feedback') {
    const { question, reponse, pointMethode, niveau: niveauReponse } = body
    if (!question || !reponse || String(reponse).trim().length < 20) {
      return NextResponse.json({ error: 'Réponse trop courte (minimum 20 caractères)' }, { status: 400 })
    }
    const niveau = niveauReponse || course.niveau || 'L1'

    const chunks = await retrieveChunks(params.id, question, 4)
    const ragContext = chunks.length > 0 ? chunks.join('\n\n') : course.rawContent.slice(0, 2000)

    const prompt = `Tu es un chargé de TD de droit. Évalue la réponse de l'étudiant à cette question.

${getNiveauInstruction(niveau)}

QUESTION : ${question}
POINT DE MÉTHODE ATTENDU : ${pointMethode || 'Non précisé'}

EXTRAITS DU COURS (seules références autorisées) :
${ragContext}

RÉPONSE DE L'ÉTUDIANT :
${String(reponse).trim()}

Génère en JSON strict. Sois bienveillant mais précis. Ne complète jamais avec des infos hors cours.
{
  "mention": "Très bien | Bien | Passable | Insuffisant",
  "pointsForts": ["point fort 1", "point fort 2"],
  "ameliorations": ["amélioration concrète 1", "amélioration concrète 2"],
  "feedback": "Commentaire général (2-3 phrases, ton de chargé de TD bienveillant)",
  "avertissement": "${AI_WARNING}"
}`

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!parsed.mention) throw new Error('JSON invalide')
        return parsed
      })
      return NextResponse.json(data)
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      console.error('[QUESTIONS-TD] feedback:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
