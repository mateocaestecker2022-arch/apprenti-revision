import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_TOKEN
}

export async function GET() {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const suggestions = await prisma.suggestion.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true, filiere: true } } },
  })

  return NextResponse.json(suggestions)
}
