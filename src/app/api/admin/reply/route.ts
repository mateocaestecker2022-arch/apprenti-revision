import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// [FIX #1] Échappement HTML pour éviter XSS dans les emails
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function isAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_TOKEN
}

// [FIX #14] Validation basique d'adresse email
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  const admin = await isAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { toEmail, toName, message, originalContent } = await req.json().catch(() => ({}))
  if (!toEmail || !message?.trim()) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // [FIX #14] Valider que toEmail est une adresse email valide
  if (!isValidEmail(toEmail)) {
    return NextResponse.json({ error: 'Email destinataire invalide' }, { status: 400 })
  }

  // [FIX #1] Échapper tout le contenu utilisateur avant injection dans le HTML
  const safeOriginal = originalContent ? escHtml(originalContent).replace(/\n/g, '<br>') : null
  const safeMessage = escHtml(message.trim()).replace(/\n/g, '<br>')

  await resend.emails.send({
    from: 'Apprenti Révision <noreply@apprenti-revision.fr>',
    to: toEmail,
    subject: 'Réponse à ton message — Apprenti Révision',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#4f46e5;margin-bottom:4px;">Apprenti Révision</h2>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">Réponse à ton message</p>

        ${safeOriginal ? `
        <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:3px solid #d1d5db;">
          <p style="margin:0;color:#9ca3af;font-size:12px;margin-bottom:6px;">Ton message :</p>
          <p style="margin:0;color:#6b7280;font-size:14px;font-style:italic;">${safeOriginal}</p>
        </div>
        ` : ''}

        <div style="background:#eef2ff;border-radius:8px;padding:16px;border-left:4px solid #4f46e5;">
          <p style="margin:0;color:#1e1b4b;font-size:15px;line-height:1.6;">${safeMessage}</p>
        </div>

        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          — L'équipe Apprenti Révision
        </p>
      </div>
    `,
  })

  console.log(`[Reply] Réponse envoyée à ${toName || toEmail}`)
  return NextResponse.json({ ok: true })
}
