import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import { getStructurePedagogique, reorderChunksByPeda } from '@/lib/pedagogie'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

const TYPE_LABELS: Record<string, string> = {
  cas_pratique: 'Cas pratique',
  commentaire_arret: "Commentaire d'arrêt",
  dissertation: 'Dissertation juridique',
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json()
  const type = body.type as string
  if (!['cas_pratique', 'commentaire_arret', 'dissertation'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  const niveau = (body.niveau as string) || (course as { niveau?: string }).niveau || 'L1'

  const typeLabel = TYPE_LABELS[type]
  const niveauInstruction = getNiveauInstruction(niveau)
  const rawChunks = await retrieveChunks(params.id, `méthode ${typeLabel} droit`, 8)

  // #21 — Réordonner les chunks selon la structure pédagogique si disponible
  const structure = await getStructurePedagogique(params.id, course.rawContent).catch(() => null)
  const orderedChunks = structure ? reorderChunksByPeda(rawChunks, structure) : rawChunks

  const ragContext = orderedChunks.length > 0
    ? orderedChunks.join('\n\n')
    : course.rawContent.slice(0, 3000)

  const structureNote = structure
    ? `\nORDRE PÉDAGOGIQUE DES NOTIONS (du fondamental au complexe) : ${structure.ordrePedagogique.join(' → ')}\n`
    : ''

  const prompt = `Tu es un professeur de droit niveau Licence/Master.
Génère une fiche de méthodologie juridique pour "${typeLabel}" adaptée à ce cours.

CONSIGNE ANTI-INVENTION ABSOLUE : toutes les références juridiques (articles, arrêts, principes) doivent provenir UNIQUEMENT des extraits du cours ci-dessous. Si une information n'est pas dans le cours, écris "non précisé dans le cours".

${niveauInstruction}
${structureNote}
EXTRAITS DU COURS (ordonnés du fondamental au complexe) :
${ragContext}

Génère en JSON strict. Pour "citationsVerifiees", liste TOUTES les références juridiques (articles, arrêts) que tu mentionnes dans la fiche. Pour chaque référence, indique si elle est littéralement présente dans les extraits du cours ci-dessus ("present_dans_le_cours") ou non ("non_precise_dans_le_cours").
{
  "type": "${type}",
  "typeLabel": "${typeLabel}",
  "etapes": [
    { "numero": 1, "titre": "...", "objectif": "...", "conseils": "...", "erreurFrequente": "..." }
  ],
  "planType": ["I. ...", "A. ...", "B. ...", "II. ...", "A. ...", "B. ..."],
  "vocabulaireCle": [{ "terme": "...", "definition": "..." }],
  "piegesAEviter": ["..."],
  "citationsVerifiees": [
    { "type": "article", "reference": "article 1240 du Code civil", "statut": "present_dans_le_cours" },
    { "type": "arret", "reference": "Cass. civ. 1ère, 13 févr. 2001", "statut": "non_precise_dans_le_cours" }
  ],
  "avertissement": "${AI_WARNING}"
}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON')
      const content = JSON.parse(match[0])
      if (!content.etapes || !Array.isArray(content.etapes) || content.etapes.length === 0) {
        throw new Error('JSON invalide')
      }

      const methodo = await prisma.methodo.create({
        data: { courseId: params.id, type, content },
      })
      return NextResponse.json({ id: methodo.id, ...content })
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        return NextResponse.json({ error: 'Quota IA journalier dépassé. Réessaie dans quelques heures.' }, { status: 429 })
      }
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      console.error('[METHODO] Erreur:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const methodos = await prisma.methodo.findMany({
    where: { courseId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(methodos)
}
