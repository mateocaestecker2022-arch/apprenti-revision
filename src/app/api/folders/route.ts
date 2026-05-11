import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const folders = await prisma.folder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(folders)
  } catch (error) {
    console.error('[GET /api/folders]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { name, color } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const safeColor = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color) ? color : '#6366f1'

    const folder = await prisma.folder.create({
      data: { name: name.trim(), color: safeColor, userId: session.user.id },
    })
    return NextResponse.json(folder)
  } catch (error) {
    console.error('[POST /api/folders]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
