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

  const subject = (course as { subject?: string }).subject || 'Général'

  const structured = course.structuredContent as {
    sections?: Array<{ title: string; points?: string[]; notions?: Array<{ term: string; definition: string }> }>
  } | null

  // Construire un contexte qui couvre TOUTES les sections proportionnellement
  // Budget réduit à 1000 chars pour rester sous la limite de 6000 tokens Groq
  const context = structured?.sections
    ? (() => {
        const sections = structured.sections!
        const charsPerSection = Math.max(80, Math.floor(2000 / sections.length))
        return sections.map(s => {
          const sec = s as { retenir?: string }
          const parts = [`## ${s.title}`]
          // Inclure toutes les notions (définitions)
          if (s.notions?.length) {
            s.notions.slice(0, 4).forEach(n => {
              parts.push(`${n.term}: ${n.definition}`.slice(0, 120))
            })
          }
          if (sec.retenir) parts.push(sec.retenir.slice(0, 80))
          else if (s.points?.length) parts.push(s.points[0].slice(0, 80))
          return parts.join('\n')
        }).join('\n\n').slice(0, 2000)
      })()
    : course.rawContent.slice(0, 2000)

  // Récupérer les 3 derniers quiz pour éviter les répétitions
  const pastQuizzes = await prisma.quiz.findMany({
    where: { courseId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })
  const pastQuestions = pastQuizzes
    .flatMap(q => (q.questions as Array<{ question: string }>))
    .map(q => q.question.slice(0, 80))
    .slice(0, 20)

  const avoidSection = pastQuestions.length > 0
    ? `\nINTERDIT ABSOLU — ces questions ont déjà été posées, ne les reprends PAS même reformulées :\n${pastQuestions.map(q => `- ${q}`).join('\n')}\n`
    : ''

  const prompt = `Génère 20 QCM niveau Licence/Master en ${subject} couvrant équitablement toutes les sections. Max 2 questions par section.
Mélange obligatoire : au moins 7 questions sur des DÉFINITIONS ("Qu'est-ce que...", "Définissez..."), au moins 6 questions d'APPLICATION, au moins 4 d'ANALYSE.
"answer" = index 0-3, varie-le.
${avoidSection}
JSON uniquement :
{"questions":[{"question":"?","options":["A","B","C","D"],"answer":0,"explanation":"Explication courte."}]}

COURS :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const { questions } = JSON.parse(raw)

      if (!questions || questions.length === 0) {
        return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
      }

      const quiz = await prisma.quiz.create({
        data: { courseId: params.id, questions },
      })

      return NextResponse.json({ id: quiz.id, questions })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < maxRetries) {
        console.warn(`[QUIZ] Rate limit, retry ${attempt}/${maxRetries}...`)
        await new Promise(r => setTimeout(r, 15000 * attempt))
        continue
      }
      console.error(`[QUIZ] Erreur (tentative ${attempt}):`, err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur après plusieurs tentatives' }, { status: 500 })
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
