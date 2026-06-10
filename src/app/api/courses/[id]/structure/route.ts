import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStructurePedagogique } from '@/lib/pedagogie'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  // Invalider le cache pour forcer un recalcul
  await prisma.methodo.deleteMany({ where: { courseId: params.id, type: 'structure_peda' } })

  const structure = await getStructurePedagogique(params.id, course.rawContent)
  if (!structure) return NextResponse.json({ error: 'Impossible de calculer la structure' }, { status: 500 })

  return NextResponse.json(structure)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const cached = await prisma.methodo.findFirst({
    where: { courseId: params.id, type: 'structure_peda' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(cached ? cached.content : null)
}
