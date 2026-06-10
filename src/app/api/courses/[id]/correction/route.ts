import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json()
  const texte = typeof body.texte === 'string' ? body.texte.trim() : ''
  if (!texte || texte.length < 50) {
    return NextResponse.json({ error: 'Texte trop court (minimum 50 caractères)' }, { status: 400 })
  }
  if (texte.length > 8000) {
    return NextResponse.json({ error: 'Texte trop long (maximum 8000 caractères)' }, { status: 400 })
  }
  const niveau = (body.niveau as string) || (course as { niveau?: string }).niveau || 'L1'
  const niveauInstruction = getNiveauInstruction(niveau)
  const chunks = await retrieveChunks(params.id, texte.slice(0, 200), 5)
  const ragContext = chunks.length > 0
    ? chunks.join('\n\n')
    : course.rawContent.slice(0, 2000)

  const prompt = `Tu es un correcteur de droit niveau Licence/Master.
Évalue cette copie selon la grille suivante. Chaque critère est noté sur 20.

${niveauInstruction}

RÉFÉRENCES DU COURS (seules références autorisées) :
${ragContext}

COPIE À CORRIGER :
${texte}

Génère en JSON strict :
{
  "criteres": [
    { "nom": "Syllogisme juridique", "note": 0, "pointsForts": "...", "pointsFaibles": "...", "suggestions": "..." },
    { "nom": "Structure du plan", "note": 0, "pointsForts": "...", "pointsFaibles": "...", "suggestions": "..." },
    { "nom": "Vocabulaire juridique", "note": 0, "pointsForts": "...", "pointsFaibles": "...", "suggestions": "..." },
    { "nom": "Argumentation", "note": 0, "pointsForts": "...", "pointsFaibles": "...", "suggestions": "..." },
    { "nom": "Forme (orthographe/syntaxe)", "note": 0, "pointsForts": "...", "pointsFaibles": "...", "suggestions": "..." }
  ],
  "noteGlobale": 0,
  "commentaireGeneral": "...",
  "prioriteProgression": "Le point le plus urgent à améliorer en une phrase.",
  "avertissement": "${AI_WARNING}"
}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON')
      const data = JSON.parse(match[0])
      if (!data.criteres || !Array.isArray(data.criteres) || data.criteres.length !== 5) {
        throw new Error('JSON invalide')
      }
      return NextResponse.json(data)
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      console.error('[CORRECTION] Erreur:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}
