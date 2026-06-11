import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  // Récupérer tous les chunks dans l'ordre pour une analyse complète du cours
  const chunks = await prisma.courseChunk.findMany({
    where: { courseId: params.id },
    orderBy: { ordre: 'asc' },
    select: { contenu: true },
  })
  const courseText = chunks.length > 0
    ? chunks.map(c => c.contenu).join('\n\n').slice(0, 8000)
    : course.rawContent.slice(0, 8000)

  const prompt = `Tu es un expert pédagogique. Analyse ce cours de droit de façon DOCUMENTAIRE uniquement.
RÈGLE ABSOLUE : tu analyses CE QUI EST ÉCRIT dans le cours. Tu n'inventes rien, tu ne combles aucun trou.

COURS À ANALYSER :
${courseText}

Génère en JSON strict :
{
  "notions": [
    {
      "concept": "nom de la notion",
      "etat": "defini" | "mentionne_mais_non_defini" | "cite_sans_explication",
      "occurrences": 3,
      "extrait": "phrase du cours où elle apparaît (courte, 10-20 mots max)"
    }
  ],
  "trous": [
    {
      "type": "notion_sans_definition" | "article_sans_explication" | "jurisprudence_sans_apport",
      "reference": "nom exact",
      "contexte": "comment elle apparaît dans le cours (10-15 mots)"
    }
  ],
  "forces": [
    "point fort du cours en une phrase"
  ],
  "synthese": "Résumé en 2-3 phrases : ce que le cours couvre bien, ce qui manque. Neutre et factuel.",
  "niveauCouverture": "complet" | "partiel" | "introductif"
}

Règles :
- "notions" : entre 5 et 15 notions les plus importantes détectées
- "trous" : uniquement ce qui EST dans le cours mais INSUFFISAMMENT développé. Maximum 8 entrées.
- "forces" : 2 à 4 points forts observés
- Si le cours est complet sur un point, ne le mets pas dans "trous"`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.15,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON')
      const data = JSON.parse(match[0])
      if (!Array.isArray(data.notions) || !Array.isArray(data.trous)) throw new Error('JSON invalide')

      return NextResponse.json(data)
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      console.error('[ANALYSE] Erreur:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}
