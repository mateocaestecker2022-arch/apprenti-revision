import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const normalizedEmail = email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // On répond toujours OK pour ne pas révéler si l'email existe
    if (!user) return NextResponse.json({ success: true })

    // [FIX #5] Rate limiting — 1 email max toutes les 55 min (token expire à 60 min)
    const recentToken = await prisma.passwordResetToken.findFirst({ where: { email: normalizedEmail } })
    if (recentToken && recentToken.expiresAt > new Date(Date.now() - 55 * 60 * 1000)) {
      return NextResponse.json({ success: true }) // silencieux — pas de nouveau token
    }

    // Supprimer les anciens tokens pour cet email
    await prisma.passwordResetToken.deleteMany({ where: { email: normalizedEmail } })

    // Créer un nouveau token (expire dans 1h)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: { email: normalizedEmail, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await resend.emails.send({
      from: 'Apprenti Révision <noreply@apprenti-revision.fr>',
      to: normalizedEmail,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4f46e5;">Apprenti Révision</h2>
          <p>Tu as demandé à réinitialiser ton mot de passe.</p>
          <p>Clique sur le bouton ci-dessous. Ce lien expire dans <strong>1 heure</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
            Réinitialiser mon mot de passe
          </a>
          <p style="color:#888;font-size:13px;">Si tu n'as pas fait cette demande, ignore cet email.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/auth/forgot-password]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
