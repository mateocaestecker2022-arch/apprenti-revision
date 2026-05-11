import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_TOKEN
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const take = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200)
  const skip = parseInt(searchParams.get('offset') ?? '0')

  const [suggestions, total] = await Promise.all([
    prisma.suggestion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, filiere: true } } },
      take,
      skip,
    }),
    prisma.suggestion.count(),
  ])

  return NextResponse.json({ suggestions, total, take, skip })
}
