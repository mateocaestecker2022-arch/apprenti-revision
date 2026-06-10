import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

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
    ? (() => {
        const sections = structured.sections!
        const charsPerSection = Math.max(150, Math.floor(6000 / sections.length))
        return sections.map(s => {
          const sec = s as { retenir?: string }
          const parts = [`## ${s.title}`]
          if (s.notions?.length) {
            s.notions.forEach(n => parts.push(`${n.term}: ${n.definition}`.slice(0, 150)))
          }
          if (s.points?.length) parts.push(...s.points.slice(0, 3).map(p => p.slice(0, 100)))
          if (sec.retenir) parts.push(sec.retenir.slice(0, 120))
          return parts.join('\n').slice(0, charsPerSection)
        }).join('\n\n').slice(0, 6000)
      })()
    : course.rawContent.slice(0, 6000)

  const prompt = `Tu es un professeur. Génère 10 flashcards supplémentaires basées UNIQUEMENT sur ce cours, en couvrant différentes sections.
Réponds UNIQUEMENT avec ce JSON valide :
{"cards":[{"question":"Question courte ?","answer":"Réponse claire et complète"}]}

COURS :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const matchRaw = raw.match(/\{[\s\S]*\}/)
      if (!matchRaw) throw new Error('Pas de JSON dans la réponse')
      const generatedCards: Array<{ question: string; answer: string }> = (JSON.parse(matchRaw[0]).cards || [])
        .filter((c: { question?: string; answer?: string }) => c.question && c.answer)

      const allCards = [...notionCards, ...generatedCards]
      if (allCards.length === 0) throw new Error('Aucune carte générée')

      await prisma.flashcard.deleteMany({ where: { courseId: params.id } })
      await prisma.flashcard.createMany({
        data: allCards.map((c) => ({
          courseId: params.id,
          question: String(c.question),
          answer: String(c.answer),
        })),
      })

      return NextResponse.json({ cards: allCards })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < maxRetries) {
        console.warn(`[FLASHCARDS] Rate limit, retry ${attempt}/${maxRetries}...`)
        await new Promise(r => setTimeout(r, 15000 * attempt))
        continue
      }
      if (attempt < maxRetries) {
        console.warn(`[FLASHCARDS] Erreur tentative ${attempt}, retry...`, (err as Error).message)
        await new Promise(r => setTimeout(r, 3000))
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

  try {
    // [FIX #4] Vérifier que le cours appartient à l'user avant de retourner ses flashcards
    const course = await prisma.course.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (!course) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const cards = await prisma.flashcard.findMany({ where: { courseId: params.id } })
    return NextResponse.json(cards)
  } catch (error) {
    console.error('[GET /api/courses/[id]/flashcards]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
