import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { courseQueue } from '@/lib/queue'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { content, folderId, subject } = await req.json()

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu trop court' }, { status: 400 })
  }

  // [FIX #8] Limite haute — évite des centaines de chunks Groq et un coût non maîtrisé
  if (content.length > 150_000) {
    return NextResponse.json({ error: 'Contenu trop volumineux (max 150 000 caractères)' }, { status: 413 })
  }

  // Quota Groq : 5 cours créés max par user par 24h
  const rl = await rateLimit(`groq-quota:${session.user.id}`, 5, 24 * 60 * 60)
  if (!rl.allowed) {
    const h = Math.ceil(rl.retryAfter / 3600)
    return NextResponse.json(
      { error: `Quota atteint : 5 cours maximum par jour. Réessaie dans ${h}h.` },
      { status: 429 }
    )
  }

  const VALID_SUBJECTS = ['Droit', 'Médecine', 'Informatique', 'Histoire', 'Économie', 'Sciences', 'Philosophie', 'Mathématiques', 'Général']

  try {
    // Si aucun subject fourni, utilise la filière de l'utilisateur
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { filiere: true } })
    const rawSubject = subject || user?.filiere || 'Général'
    const resolvedSubject = VALID_SUBJECTS.includes(rawSubject) ? rawSubject : 'Général'

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
        subject: resolvedSubject,
      },
    })

    // Envoyer le job au worker BullMQ
    await courseQueue.add('process-course', {
      courseId: course.id,
      content,
      subject: resolvedSubject,
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

  try {
    const courses = await prisma.course.findMany({
      where: { userId: session.user.id },
      include: { folder: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(courses)
  } catch (error) {
    console.error('[GET /api/courses]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
