import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sm2 } from '@/lib/sm2'

// GET — cartes à réviser aujourd'hui (dues + nouvelles, max 20)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = session.user.id
  const now = new Date()

  // 1. Cartes avec une révision en retard
  const dueReviews = await prisma.flashcardReview.findMany({
    where: { userId, nextReview: { lte: now } },
    include: {
      flashcard: {
        include: { course: { select: { title: true, id: true } } },
      },
    },
    orderBy: { nextReview: 'asc' },
    take: 20,
  })

  // 2. Nouvelles cartes (jamais révisées), pour compléter jusqu'à 20
  const remaining = 20 - dueReviews.length
  let newCards: Array<{
    id: string
    question: string
    answer: string
    course: { title: string; id: string }
  }> = []

  if (remaining > 0) {
    const allReviewedIds = await prisma.flashcardReview.findMany({
      where: { userId },
      select: { flashcardId: true },
    })
    const excludeIds = allReviewedIds.map((r) => r.flashcardId)

    newCards = await prisma.flashcard.findMany({
      where: {
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        course: { userId },
      },
      include: { course: { select: { title: true, id: true } } },
      take: remaining,
    })
  }

  const cards = [
    ...dueReviews.map((r) => ({
      id: r.flashcard.id,
      question: r.flashcard.question,
      answer: r.flashcard.answer,
      courseTitle: r.flashcard.course.title,
      courseId: r.flashcard.course.id,
      isNew: false,
    })),
    ...newCards.map((c) => ({
      id: c.id,
      question: c.question,
      answer: c.answer,
      courseTitle: c.course.title,
      courseId: c.course.id,
      isNew: true,
    })),
  ]

  return NextResponse.json({ cards })
}

// POST — enregistrer une réponse { flashcardId, quality: 1|3|5 }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = session.user.id

  const { flashcardId, quality } = await req.json()
  if (!flashcardId || quality === undefined) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Récupérer l'état actuel de la carte
  const existing = await prisma.flashcardReview.findUnique({
    where: { flashcardId_userId: { flashcardId, userId } },
  })

  const result = sm2(
    quality,
    existing?.repetition ?? 0,
    existing?.easeFactor ?? 2.5,
    existing?.interval ?? 0
  )

  // Upsert FlashcardReview
  await prisma.flashcardReview.upsert({
    where: { flashcardId_userId: { flashcardId, userId } },
    create: {
      flashcardId,
      userId,
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetition: result.repetition,
      nextReview: result.nextReview,
    },
    update: {
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetition: result.repetition,
      nextReview: result.nextReview,
    },
  })

  // Incrémenter la session du jour
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todaySession = await prisma.studySession.findFirst({
    where: { userId, date: { gte: today, lt: tomorrow } },
  })

  if (todaySession) {
    await prisma.studySession.update({
      where: { id: todaySession.id },
      data: { cardsStudied: { increment: 1 } },
    })
  } else {
    await prisma.studySession.create({
      data: { userId, cardsStudied: 1 },
    })
  }

  return NextResponse.json({ success: true, nextReview: result.nextReview, interval: result.interval })
}
