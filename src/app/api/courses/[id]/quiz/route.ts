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

  // Construire un contexte complet depuis le contenu structuré
  const context = structured?.sections
    ? structured.sections.map(s => {
        const parts = [`## ${s.title}`]
        if (s.notions?.length) parts.push(s.notions.map(n => `${n.term}: ${n.definition}`).join('\n'))
        if (s.points?.length) parts.push(s.points.join('\n'))
        const sec = s as { retenir?: string }
        if (sec.retenir) parts.push(`À retenir: ${sec.retenir}`)
        return parts.join('\n')
      }).join('\n\n').slice(0, 4000)
    : course.rawContent.slice(0, 4000)

  // Récupérer les questions des derniers quiz pour les éviter
  const pastQuizzes = await prisma.quiz.findMany({
    where: { courseId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })
  const pastQuestions = pastQuizzes
    .flatMap(q => (q.questions as Array<{ question: string }>))
    .map(q => q.question)
    .slice(0, 20)

  const avoidSection = pastQuestions.length > 0
    ? `\nÉVITE ces questions déjà posées :\n${pastQuestions.map(q => `- ${q}`).join('\n')}\n`
    : ''

  const prompt = `Tu es un professeur expert. Génère 20 questions de QCM VARIÉES couvrant l'ensemble du cours.
Réponds UNIQUEMENT avec ce JSON valide (sans texte avant ou après) :
{"questions":[{"question":"Question ?","options":["Option A","Option B","Option C","Option D"],"answer":0,"explanation":"Explication en 2-3 phrases : pourquoi c'est la bonne réponse, le concept clé, et ce qu'il faut retenir."}]}
Règles :
- "answer" est l'index (0-3) de la bonne réponse
- Varie les positions de la bonne réponse (pas toujours 0 ou 2)
- Couvre toutes les sections du cours, pas seulement le début
- Questions de difficulté variée (définition, application, analyse)
${avoidSection}
COURS :
${context}`

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 6000,
      temperature: 0.7,
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
