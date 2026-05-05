import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.password) {
      return NextResponse.json({ error: 'Compte invalide' }, { status: 400 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: session.user.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/account/delete]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
