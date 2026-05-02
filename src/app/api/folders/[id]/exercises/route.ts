import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      courses: {
        where: { status: 'ready' },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  if (folder.courses.length === 0) {
    return NextResponse.json({ error: 'Aucun cours prêt dans ce dossier' }, { status: 400 })
  }

  // Construire le contexte — max 1500 chars répartis sur les cours
  const charsPerCourse = Math.max(60, Math.floor(1500 / folder.courses.length))
  const context = folder.courses.map((course) => {
    const structured = course.structuredContent as {
      sections?: Array<{
        title: string
        notions?: Array<{ term: string; definition: string }>
        points?: string[]
        retenir?: string
      }>
    } | null

    const sections = structured?.sections ?? []
    const charsPerSection = Math.max(30, Math.floor(charsPerCourse / Math.max(1, sections.length)))

    const sectionsText = sections.map((s) => {
      const parts = [`[${s.title}]`]
      if (s.notions?.length) parts.push(`${s.notions[0].term}: ${s.notions[0].definition}`.slice(0, charsPerSection))
      if (s.retenir) parts.push(s.retenir.slice(0, 60))
      return parts.join(' ')
    }).join(' | ')

    return `=== ${course.title} ===\n${sectionsText || course.rawContent.slice(0, charsPerCourse)}`
  }).join('\n\n').slice(0, 1500)

  const prompt = `Tu es un professeur de droit. Génère 15 exercices de révision basés UNIQUEMENT sur le contenu fourni ci-dessous. L'étudiant ne peut pas faire de recherche — il doit connaître les réponses par cœur.

3 types d'exercices (5 de chaque) :
- "definition" : "Définissez précisément : [terme]" — la réponse est la définition exacte du cours
- "vrai_faux" : une affirmation vraie ou fausse — la réponse commence par "VRAI" ou "FAUX" puis explique pourquoi
- "application" : un micro cas pratique avec une question juridique — la réponse applique les notions du cours

JSON uniquement :
{"exercises":[{"type":"definition","question":"...","answer":"..."}]}

COURS :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })

      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON dans la réponse')

      const { exercises } = JSON.parse(match[0])
      if (!exercises || exercises.length === 0) {
        return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
      }

      const record = await prisma.folderExercise.create({
        data: { folderId: params.id, exercises },
      })

      return NextResponse.json({ id: record.id, exercises })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 15000 * attempt))
        continue
      }
      console.error(`[EXERCISES] Erreur (tentative ${attempt}):`, err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur après plusieurs tentatives' }, { status: 500 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  const record = await prisma.folderExercise.findFirst({
    where: { folderId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(record ?? null)
}
