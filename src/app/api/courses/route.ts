import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callClaude } from '@/lib/anthropic'

const SYSTEM_PROMPT = `Tu es un assistant pédagogique expert. Ton rôle est de restructurer des cours universitaires de manière claire et efficace.

Quand tu reçois un cours, tu dois retourner un JSON structuré EXACTEMENT dans ce format :
{
  "title": "Titre du cours",
  "plan": [
    { "level": 1, "text": "I. Titre principal" },
    { "level": 2, "text": "A. Sous-titre" },
    { "level": 3, "text": "1. Point détaillé" }
  ],
  "keywords": [
    { "term": "Terme", "definition": "Définition claire et concise" }
  ],
  "sections": [
    {
      "title": "Titre de la section",
      "level": 1,
      "content": "Contenu détaillé de la section en markdown"
    }
  ],
  "summary": "Résumé général du cours en 2-3 phrases"
}

Règles importantes :
- Hiérarchise clairement le contenu (titres, sous-titres)
- Extrais les notions clés avec leurs définitions
- Développe chaque section de manière détaillée
- Réponds UNIQUEMENT avec le JSON, sans texte avant ou après`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { content, folderId } = await req.json()

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu trop court' }, { status: 400 })
  }

  // Limiter à 6000 caractères pour respecter les limites Groq
  const truncated = content.length > 6000
    ? content.slice(0, 6000) + '\n\n[Contenu tronqué pour le traitement]'
    : content

  try {
    const raw = await callClaude(truncated, SYSTEM_PROMPT)

    // Extraire le JSON de la réponse
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Erreur de traitement IA' }, { status: 500 })
    }

    const structured = JSON.parse(jsonMatch[0])

    const course = await prisma.course.create({
      data: {
        title: structured.title || 'Cours sans titre',
        rawContent: truncated,
        structuredContent: structured,
        keywords: structured.keywords || [],
        userId: session.user.id,
        folderId: folderId || null,
      },
    })

    return NextResponse.json({ id: course.id, title: course.title })
  } catch (error) {
    console.error('Erreur cours:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    include: { folder: true },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(courses)
}
