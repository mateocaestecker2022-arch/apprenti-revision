import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    // [FIX #12] Minimum 12 caractères conformément au CDC sécurité
    if (newPassword.length < 12) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit faire au moins 12 caractères' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.password) {
      return NextResponse.json({ error: 'Compte invalide' }, { status: 400 })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: session.user.id }, data: { password: hash } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/account/password]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
