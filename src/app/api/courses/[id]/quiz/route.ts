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

  const subject = (course as { subject?: string }).subject || 'Général'

  const structured = course.structuredContent as {
    sections?: Array<{ title: string; points?: string[]; notions?: Array<{ term: string; definition: string }>; retenir?: string }>
  } | null

  const sections = structured?.sections || []
  const totalQuestions = 20
  const nbSections = sections.length

  // Quota par section : au minimum 1, réparti proportionnellement
  const quotas: number[] = []
  if (nbSections > 0) {
    const base = Math.floor(totalQuestions / nbSections)
    const remainder = totalQuestions - base * nbSections
    for (let i = 0; i < nbSections; i++) {
      quotas.push(base + (i < remainder ? 1 : 0))
    }
  }

  // Construire le contexte + plan de génération par section
  const charsPerSection = nbSections > 0 ? Math.max(300, Math.floor(7000 / nbSections)) : 7000
  const sectionBlocks = sections.map((s, i) => {
    const parts = [`### SECTION ${i + 1} — ${s.title} (génère ${quotas[i]} question(s))`]
    if (s.notions?.length) {
      s.notions.forEach(n => parts.push(`- ${n.term}: ${n.definition}`.slice(0, 180)))
    }
    if (s.points?.length) parts.push(...s.points.slice(0, 4).map(p => `• ${p}`.slice(0, 120)))
    if (s.retenir) parts.push(`À retenir: ${s.retenir}`.slice(0, 150))
    return parts.join('\n').slice(0, charsPerSection)
  })

  const context = nbSections > 0
    ? sectionBlocks.join('\n\n').slice(0, 7000)
    : course.rawContent.slice(0, 7000)

  // Récupérer les questions passées pour dédupliquer côté code
  const pastQuizzes = await prisma.quiz.findMany({
    where: { courseId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { questions: true },
  })
  const pastQuestionTexts = new Set(
    pastQuizzes
      .flatMap(q => (q.questions as Array<{ question: string }>))
      .map(q => q.question.trim().toLowerCase().slice(0, 80))
  )

  const sectionPlan = nbSections > 0
    ? `\nRÉPARTITION OBLIGATOIRE — respecte exactement ces quotas :\n${sections.map((s, i) => `• Section "${s.title}" : ${quotas[i]} question(s)`).join('\n')}\n`
    : ''

  const isDroit = /droit|juridique|loi|jurisprudence/i.test(subject)

  const styleInstruction = isDroit
    ? `Mélange : définitions, applications, analyses ET mises en situation.
Pour les mises en situation (au moins 8 questions sur ${totalQuestions}) : présente un cas concret inventé (ex : "M. Dupont signe un contrat avec…", "Une société refuse de…", "Un employeur licencie…") que l'étudiant doit analyser pour choisir la règle applicable, la qualification juridique ou l'issue légale correcte.`
    : `Mélange : définitions, applications, analyses.`

  const prompt = `Tu es un professeur. Génère exactement ${totalQuestions} QCM niveau Licence/Master en ${subject} basés UNIQUEMENT sur le cours ci-dessous.
${sectionPlan}
${styleInstruction}
Varie l'"answer" (0, 1, 2, 3) de façon équilibrée.
JSON uniquement :
{"questions":[{"question":"?","options":["A","B","C","D"],"answer":0,"explanation":"Explication courte.","section":"Titre de la section"}]}

COURS :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4500,
        temperature: 0.85,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON dans la réponse')
      const parsed = JSON.parse(match[0])
      const seenInBatch = new Set<string>()
      const questions = (parsed.questions || []).filter((q: {
        question?: string; options?: string[]; answer?: number; explanation?: string
      }) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) return false
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) return false
        // Déduplique contre les anciens quiz ET dans le batch courant
        const key = q.question.trim().toLowerCase().slice(0, 80)
        if (pastQuestionTexts.has(key) || seenInBatch.has(key)) return false
        seenInBatch.add(key)
        return true
      })

      if (!questions || questions.length === 0) {
        throw new Error('Aucune question valide générée')
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
      if (attempt < maxRetries) {
        console.warn(`[QUIZ] Erreur tentative ${attempt}, retry...`, (err as Error).message)
        await new Promise(r => setTimeout(r, 3000))
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

  try {
    // [FIX #4] Vérifier que le cours appartient à l'user avant de retourner le quiz
    const course = await prisma.course.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (!course) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const quiz = await prisma.quiz.findFirst({
      where: { courseId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(quiz)
  } catch (error) {
    console.error('[GET /api/courses/[id]/quiz]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
