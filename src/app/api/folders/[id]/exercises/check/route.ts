import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { question, expectedAnswer, userAnswer } = await req.json()

  if (!question || !expectedAnswer || !userAnswer?.trim()) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  const prompt = `Tu es un correcteur pédagogique niveau Licence/Master. Évalue la réponse de l'étudiant.

Question : ${question.slice(0, 300)}
Réponse attendue : ${expectedAnswer.slice(0, 400)}
Réponse de l'étudiant : ${userAnswer.slice(0, 400)}

Évalue si l'étudiant a bien identifié les éléments essentiels. Sois pédagogue.

JSON uniquement :
{"score":"correct"|"partiel"|"incorrect","feedback":"Feedback en 2-3 phrases max."}`

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const raw = res.choices[0]?.message?.content || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Pas de JSON')

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('[CHECK]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
