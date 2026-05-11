import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  // Rate limit : 10 tentatives / 15 min par IP pour bloquer le brute-force
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const rl = await rateLimit(`admin-auth:${ip}`, 10, 15 * 60)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessaie dans ${Math.ceil(rl.retryAfter / 60)} min.` },
      { status: 429 }
    )
  }

  const { password } = await req.json().catch(() => ({}))

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_token', process.env.ADMIN_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // [FIX #2] HTTPS uniquement en prod
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_token')
  return res
}
