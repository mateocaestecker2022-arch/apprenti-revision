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

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const generatedCards: Array<{ question: string; answer: string }> = JSON.parse(raw).cards || []

      const allCards = [...notionCards, ...generatedCards]

      await prisma.flashcard.deleteMany({ where: { courseId: params.id } })
      await prisma.flashcard.createMany({
        data: allCards.map((c) => ({
          courseId: params.id,
          question: c.question,
          answer: c.answer,
        })),
      })

      return NextResponse.json({ cards: allCards })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < maxRetries) {
        console.warn(`[FLASHCARDS] Rate limit, retry ${attempt}/${maxRetries}...`)
        await new Promise(r => setTimeout(r, 10000 * attempt))
        continue
      }
      console.error(`[FLASHCARDS] Erreur (tentative ${attempt}):`, err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur après plusieurs tentatives' }, { status: 500 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cards = await prisma.flashcard.findMany({ where: { courseId: params.id } })
  return NextResponse.json(cards)
}
