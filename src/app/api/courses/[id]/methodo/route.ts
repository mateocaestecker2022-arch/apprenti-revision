import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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
  const chunks = await retrieveChunks(params.id, `méthode ${typeLabel} droit`, 6)
  const ragContext = chunks.length > 0
    ? chunks.join('\n\n')
    : course.rawContent.slice(0, 3000)

  const prompt = `Tu es un professeur de droit niveau Licence/Master.
Génère une fiche de méthodologie juridique pour "${typeLabel}" adaptée à ce cours.

CONSIGNE ANTI-INVENTION ABSOLUE : toutes les références juridiques (articles, arrêts, principes) doivent provenir UNIQUEMENT des extraits du cours ci-dessous. Si une information n'est pas dans le cours, écris "non précisé dans le cours".

${niveauInstruction}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "type": "${type}",
  "typeLabel": "${typeLabel}",
  "etapes": [
    { "numero": 1, "titre": "...", "objectif": "...", "conseils": "...", "erreurFrequente": "..." }
  ],
  "planType": ["I. ...", "A. ...", "B. ...", "II. ...", "A. ...", "B. ..."],
  "vocabulaireCle": [{ "terme": "...", "definition": "..." }],
  "piegesAEviter": ["..."],
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
