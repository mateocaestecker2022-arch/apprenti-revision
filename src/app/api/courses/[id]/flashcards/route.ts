import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const structured = course.structuredContent as {
    sections?: Array<{ title: string; notions?: Array<{ term: string; definition: string }>; points?: string[] }>
  } | null

  // Utiliser les notions déjà extraites + générer des questions sur les points
  const notionCards = structured?.sections?.flatMap(s =>
    (s.notions || []).map(n => ({ question: `Qu'est-ce que "${n.term}" ?`, answer: n.definition }))
  ) || []

  const context = structured?.sections
    ?.map(s => `${s.title}: ${(s.points || []).join(' ')}`)
    .join('\n') || course.rawContent.slice(0, 3000)

  const prompt = `Tu es un professeur. Génère 10 flashcards supplémentaires sur ce cours.
Réponds UNIQUEMENT avec ce JSON valide :
{"cards":[{"question":"Question courte ?","answer":"Réponse claire et complète"}]}

COURS :
${context}`

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.4,
    })
    const raw = res.choices[0]?.message?.content || ''
    const match = raw.match(/\{[\s\S]*\}/)
    const generatedCards = match ? (JSON.parse(match[0]).cards || []) : []

    const allCards = [...notionCards, ...generatedCards]

    // Supprimer les anciennes flashcards et recréer
    await prisma.flashcard.deleteMany({ where: { courseId: params.id } })
    await prisma.flashcard.createMany({
      data: allCards.map((c: { question: string; answer: string }) => ({
        courseId: params.id,
        question: c.question,
        answer: c.answer,
      })),
    })

    return NextResponse.json({ cards: allCards })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cards = await prisma.flashcard.findMany({ where: { courseId: params.id } })
  return NextResponse.json(cards)
}
