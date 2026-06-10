import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const niveau = (body.niveau as string) || (course as { niveau?: string }).niveau || 'L1'
  const niveauInstruction = getNiveauInstruction(niveau)
  const chunks = await retrieveChunks(params.id, 'règle juridique applicable mécanisme', 6)
  const ragContext = chunks.length > 0
    ? chunks.join('\n\n')
    : course.rawContent.slice(0, 3000)

  const prompt = `Tu es un professeur de droit. Génère un cas pratique inventé adapté à ce cours.

CONSIGNE ANTI-INVENTION : les faits sont librement inventés, mais les règles de droit appliquées DOIVENT provenir UNIQUEMENT des extraits du cours ci-dessous.

${niveauInstruction}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "enonce": "Énoncé du cas pratique (3-5 lignes de faits inventés concrets)",
  "questionInitiale": "Quels sont les faits juridiquement pertinents dans cette situation ?",
  "avertissement": "${AI_WARNING}"
}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON')
      const data = JSON.parse(match[0])
      if (!data.enonce || !data.questionInitiale) throw new Error('JSON invalide')

      const exercice = await prisma.exerciceGuide.create({
        data: {
          courseId: params.id,
          userId: session.user.id,
          enonce: data.enonce,
          historique: [{ role: 'assistant', content: `${data.enonce}\n\n${data.questionInitiale}` }],
          etapeActuelle: 1,
        },
      })
      return NextResponse.json({
        id: exercice.id,
        enonce: data.enonce,
        questionInitiale: data.questionInitiale,
        etapeActuelle: 1,
        avertissement: AI_WARNING,
      })
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      console.error('[EXERCICE] Erreur création:', err)
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

  const exercices = await prisma.exerciceGuide.findMany({
    where: { courseId: params.id, userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  return NextResponse.json(exercices)
}
