import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

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
    select: { rawContent: true },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  // ── CONTROVERSES DOCTRINALES ──────────────────────────────────────────────
  if (action === 'controverses') {
    const concept = typeof body.concept === 'string' && body.concept.trim().length > 2
      ? body.concept.trim()
      : null

    const query = concept
      ? `controverse débat doctrinal positions ${concept}`
      : 'controverse débat positions opposées auteurs doctrine'

    const chunks = await retrieveChunks(params.id, query, 10)
    const ragContext = chunks.length > 0
      ? chunks.join('\n\n')
      : course.rawContent.slice(0, 6000)

    const prompt = `Tu es un assistant juridique. Analyse les extraits du cours ci-dessous et identifie UNIQUEMENT les controverses, débats ou tensions doctrinales qui y sont EXPLICITEMENT mentionnés.

RÈGLE ABSOLUE ANTI-INVENTION :
- N'invente AUCUNE controverse, position doctorinale, auteur ou arrêt absent du cours.
- Si le cours ne mentionne aucune controverse, dis-le clairement dans "synthese".
- "source_dans_le_cours" doit être une citation ou paraphrase exacte du cours.
${concept ? `\nFOCUS : Cherche en priorité les controverses autour de "${concept}".` : ''}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "controverses": [
    {
      "sujet": "Question ou notion débattue (ex: 'Nature juridique de la possession')",
      "positionA": "Première position ou interprétation présente dans le cours",
      "positionB": "Position opposée ou nuance présente dans le cours",
      "enjeu": "Ce que le débat révèle sur la matière",
      "source_dans_le_cours": "Passage du cours qui signale cette tension (citation)"
    }
  ],
  "synthese": "Si aucune controverse n'est trouvée, l'indiquer ici. Sinon, résumer l'intérêt pédagogique de ces débats.",
  "avertissement": "${AI_WARNING}"
}`

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2500,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!Array.isArray(parsed.controverses)) throw new Error('JSON invalide')
        return parsed
      })
      return NextResponse.json(data)
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      console.error('[CONTROVERSE] controverses:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  // ── ANALYSE COMPARATIVE ───────────────────────────────────────────────────
  if (action === 'comparative') {
    const concept = typeof body.concept === 'string' ? body.concept.trim() : ''

    const chunks = await retrieveChunks(
      params.id,
      `comparaison distinction régime différence ${concept}`,
      10,
    )
    const ragContext = chunks.length > 0
      ? chunks.join('\n\n')
      : course.rawContent.slice(0, 6000)

    const prompt = `Tu es un assistant juridique. À partir des extraits du cours ci-dessous, produis une analyse comparative structurée.

RÈGLE ABSOLUE ANTI-INVENTION : compare UNIQUEMENT des notions, mécanismes ou régimes PRÉSENTS dans ces extraits. Si une colonne de comparaison est absente du cours, indique "non précisé dans le cours".
${concept ? `\nFOCUS : Compare en priorité les éléments liés à "${concept}".` : ''}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "titre": "Titre de la comparaison (ex: 'Propriété vs possession')",
  "axes": [
    {
      "axe": "Critère de comparaison (ex: 'Définition', 'Conditions', 'Effets', 'Sanctions')",
      "elementA": { "nom": "Notion A", "contenu": "Ce que le cours dit sur cet axe" },
      "elementB": { "nom": "Notion B", "contenu": "Ce que le cours dit sur cet axe" }
    }
  ],
  "synthese": "Points communs et différences majeures en 2-3 phrases",
  "limite": "Ce que le cours ne permet pas de comparer (si applicable)",
  "avertissement": "${AI_WARNING}"
}`

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2500,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!parsed.titre || !Array.isArray(parsed.axes)) throw new Error('JSON invalide')
        return parsed
      })
      return NextResponse.json(data)
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      console.error('[CONTROVERSE] comparative:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
