import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TYPES_VALIDES = ['correction', 'methodo', 'exercice_guide']
const PROBLEMES_VALIDES = ['erreur_juridique', 'article_invente', 'methode_fausse', 'autre']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { type, refId, contenuIA, probleme, commentaire, niveau } = body

  if (!TYPES_VALIDES.includes(type)) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  if (!PROBLEMES_VALIDES.includes(probleme)) return NextResponse.json({ error: 'Problème invalide' }, { status: 400 })
  if (!refId || typeof contenuIA !== 'string') return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  const signalement = await prisma.signalement.create({
    data: {
      userId: session.user.id,
      type,
      refId,
      contenuIA: contenuIA.slice(0, 5000),
      probleme,
      commentaire: commentaire ? String(commentaire).slice(0, 1000) : null,
      niveau: niveau || null,
    },
  })
  return NextResponse.json({ id: signalement.id })
}
