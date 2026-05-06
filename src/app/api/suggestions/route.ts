import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { content, anonymous } = await req.json()
    if (!content || content.trim().length < 5) {
      return NextResponse.json({ error: 'Message trop court' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        userId: session.user.id,
        content: content.trim(),
        anonymous: !!anonymous,
      },
      include: { user: { select: { name: true, email: true, filiere: true } } },
    })

    // Notification terminal
    const displayName = anonymous ? 'Anonyme' : (suggestion.user.name || suggestion.user.email)
    console.log(`[Suggestion] Nouvelle suggestion de ${displayName} (${suggestion.user.filiere}) : "${content.trim().slice(0, 80)}${content.trim().length > 80 ? '…' : ''}"`)

    // Notification email admin (non bloquante)
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      resend.emails.send({
        from: 'Apprenti Révision <noreply@apprenti-revision.fr>',
        to: adminEmail,
        subject: `💡 Nouvelle suggestion — ${displayName}`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2 style="color:#4f46e5;">Apprenti Révision — Nouvelle suggestion</h2>
            <p><strong>De :</strong> ${anonymous ? 'Anonyme' : suggestion.user.name || 'N/A'} (${suggestion.user.email})</p>
            <p><strong>Filière :</strong> ${suggestion.user.filiere}</p>
            <p><strong>Anonyme :</strong> ${anonymous ? 'Oui' : 'Non'}</p>
            <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #4f46e5;">
              <p style="margin:0;color:#374151;">${content.trim().replace(/\n/g, '<br>')}</p>
            </div>
            <a href="${process.env.NEXTAUTH_URL}/admin/suggestions" style="display:inline-block;background:#4f46e5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              Voir dans l'admin →
            </a>
          </div>
        `,
      }).catch((err: unknown) => console.error('[Suggestion] Erreur email admin:', err))
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
