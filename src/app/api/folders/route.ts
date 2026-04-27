import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(folders)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { name, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const folder = await prisma.folder.create({
    data: { name: name.trim(), color: color || '#6366f1', userId: session.user.id },
  })

  return NextResponse.json(folder)
}
