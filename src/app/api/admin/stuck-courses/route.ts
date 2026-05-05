import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_USER_ID = 'cmohf50fk000a6k88biaq9yza'
const STUCK_MINUTES = 30

function isAdmin(id: string | null | undefined) {
  return id === ADMIN_USER_ID
}

// GET — liste des cours bloqués en processing depuis plus de STUCK_MINUTES
export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)
  const stuck = await prisma.course.findMany({
    where: { status: 'processing', updatedAt: { lt: cutoff } },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      subject: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: 'asc' },
  })

  return NextResponse.json(stuck)
}

// POST — repasse en "error" un cours spécifique (courseId) ou tous les bloqués
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isAdmin(session?.user?.id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { courseId } = await req.json().catch(() => ({}))
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)

  if (courseId) {
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'error' },
    })
    return NextResponse.json({ unblocked: 1 })
  }

  const { count } = await prisma.course.updateMany({
    where: { status: 'processing', updatedAt: { lt: cutoff } },
    data: { status: 'error' },
  })

  return NextResponse.json({ unblocked: count })
}
