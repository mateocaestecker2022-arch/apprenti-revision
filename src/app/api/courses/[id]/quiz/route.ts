import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const structured = course.structuredContent as {
    sections?: Array<{ title: string; points?: string[]; notions?: Array<{ term: string; definition: string }> }>
  } | null

  const context = structured?.sections
    ?.map(s => `${s.title}: ${(s.points || []).join(' ')}`)
    .join('\n') || course.rawContent.slice(0, 4000)

  const prompt = `Tu es un professeur. Génère 10 questions de QCM sur ce cours.
Réponds UNIQUEMENT avec ce JSON valide :
{"questions":[{"question":"Question ?","options":["A. Option","B. Option","C. Option","D. Option"],"answer":0,"explanation":"Explication courte"}]}
"answer" est l'index (0-3) de la bonne réponse.

COURS :
${context}`

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.4,
    })
    const raw = res.choices[0]?.message?.content || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })

    const { questions } = JSON.parse(match[0])

    const quiz = await prisma.quiz.create({
      data: { courseId: params.id, questions },
    })

    return NextResponse.json({ id: quiz.id, questions })
  } catch (err) {
    console.error('[QUIZ] Erreur génération:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quiz)
}
