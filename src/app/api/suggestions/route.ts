import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { content } = await req.json()
    if (!content || content.trim().length < 5) {
      return NextResponse.json({ error: 'Message trop court' }, { status: 400 })
    }

    await prisma.suggestion.create({
      data: { userId: session.user.id, content: content.trim() },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
