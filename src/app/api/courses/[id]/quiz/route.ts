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

  // Construire un contexte qui couvre TOUTES les sections proportionnellement
  const context = structured?.sections
    ? (() => {
        const sections = structured.sections!
        // Budget par section pour couvrir tout le cours (pas seulement le début)
        const charsPerSection = Math.max(120, Math.floor(4500 / sections.length))
        return sections.map(s => {
          const sec = s as { retenir?: string }
          const parts = [`## ${s.title}`]
          if (s.notions?.length) {
            // 1 notion par section (la plus importante)
            const n = s.notions[0]
            parts.push(`${n.term}: ${n.definition}`.slice(0, 120))
          }
          if (s.points?.length) {
            // 1-2 points selon le budget
            const budget = charsPerSection - parts.join('\n').length - 20
            parts.push(s.points.slice(0, 2).join(' ').slice(0, Math.max(80, budget)))
          }
          if (sec.retenir) parts.push(`À retenir: ${sec.retenir}`.slice(0, 100))
          return parts.join('\n')
        }).join('\n\n')
      })()
    : course.rawContent.slice(0, 4500)

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

  const sectionTitles = structured?.sections?.map(s => s.title).join(', ') || ''
  const prompt = `Tu es un professeur expert. Génère 20 questions QCM couvrant TOUTES les sections du cours de manière équilibrée.

RÈGLES ABSOLUES :
- Couvre CHAQUE section du cours — pas seulement le début. Le cours contient ces sections : ${sectionTitles}
- Maximum 2 questions par section — répartis sur tout le cours
- Difficulté variée : définitions (30%), mécanismes/applications (40%), analyse/nuances (30%)
- Pas de répétition : chaque question porte sur un aspect différent
- "answer" = index 0-3 de la bonne réponse, distribué aléatoirement (pas toujours 0)
${avoidSection}
Réponds UNIQUEMENT avec ce JSON valide :
{"questions":[{"question":"Question précise ?","options":["Option A","Option B","Option C","Option D"],"answer":0,"explanation":"Explication en 2-3 phrases : bonne réponse + concept clé + ce qu'il faut retenir."}]}

COURS (toutes sections) :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
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
