import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { folder: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })
    }

    return NextResponse.json(course)
  } catch (error) {
    console.error('[GET /api/courses/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if ('folderId' in body) data.folderId = body.folderId || null

    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
      if (title.length > 200) return NextResponse.json({ error: 'Titre trop long (max 200 caractères)' }, { status: 400 })
      data.title = title
    }

    if ('niveau' in body) {
      const niveaux = ['L1', 'L2', 'L3', 'M1', 'M2']
      const niveau = typeof body.niveau === 'string' ? body.niveau : ''
      if (!niveaux.includes(niveau)) return NextResponse.json({ error: 'Niveau invalide' }, { status: 400 })
      data.niveau = niveau
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

    const result = await prisma.course.updateMany({
      where: { id: params.id, userId: session.user.id },
      data,
    })

    if (result.count === 0) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/courses/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    await prisma.course.deleteMany({
      where: { id: params.id, userId: session.user.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/courses/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
