import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { courseQueue } from '@/lib/queue'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { content, folderId } = await req.json()

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu trop court' }, { status: 400 })
  }

  try {
    // Créer le cours immédiatement avec status "processing"
    const course = await prisma.course.create({
      data: {
        title: 'Traitement en cours...',
        rawContent: content,
        structuredContent: {},
        keywords: [],
        status: 'processing',
        userId: session.user.id,
        folderId: folderId || null,
      },
    })

    // Envoyer le job au worker BullMQ
    await courseQueue.add('process-course', {
      courseId: course.id,
      content,
    })

    return NextResponse.json({ id: course.id, status: 'processing' })
  } catch (error) {
    console.error('Erreur cours:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    include: { folder: true },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(courses)
}
