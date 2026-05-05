import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_TOKEN
}

export async function PATCH(req: NextRequest) {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id, public: pub } = await req.json().catch(() => ({}))
  if (!id || typeof pub !== 'boolean') {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  await prisma.suggestion.update({
    where: { id },
    data: { public: pub },
  })

  return NextResponse.json({ ok: true })
}
