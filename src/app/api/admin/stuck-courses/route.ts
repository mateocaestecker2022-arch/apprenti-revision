import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const STUCK_MINUTES = 30

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_TOKEN
}

export async function GET() {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

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

export async function POST(req: NextRequest) {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { courseId } = await req.json().catch(() => ({}))
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)

  if (courseId) {
    // [FIX #10] Filtre sur status 'processing' — évite de passer un cours 'ready' en 'error'
    const result = await prisma.course.updateMany({
      where: { id: courseId, status: 'processing' },
      data: { status: 'error' },
    })
    return NextResponse.json({ unblocked: result.count })
  }

  const { count } = await prisma.course.updateMany({
    where: { status: 'processing', updatedAt: { lt: cutoff } },
    data: { status: 'error' },
  })

  return NextResponse.json({ unblocked: count })
}
