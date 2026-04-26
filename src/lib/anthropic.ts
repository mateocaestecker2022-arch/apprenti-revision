import { GoogleGenerativeAI } from '@google/generative-ai'
import { redis } from './redis'
import crypto from 'crypto'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

const CHUNK_SIZE = 15000 // Gemini supporte beaucoup plus de tokens

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = i + CHUNK_SIZE
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + 3000) end = lastNewline
    }
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await model.generateContent(
    `${systemPrompt}\n\n${userPrompt}`
  )
  return result.response.text()
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey || `gemini:${hashContent(systemPrompt + prompt)}`

  const cached = await redis.get(key)
  if (cached) return cached

  let result: string

  if (prompt.length <= CHUNK_SIZE) {
    result = await callGemini(systemPrompt, prompt)
  } else {
    const chunks = splitIntoChunks(prompt)

    const chunkSystem = `Tu es un assistant pédagogique. Restructure cette partie de cours en JSON :
{"sections":[{"title":"Titre","level":1,"content":"Contenu complet et détaillé"}],"keywords":[{"term":"Terme","definition":"Définition"}]}
Réponds UNIQUEMENT avec le JSON valide, sans markdown.`

    const allSections: Array<{title: string, level: number, content: string}> = []
    const allKeywords: Array<{term: string, definition: string}> = []

    for (const chunk of chunks) {
      const raw = await callGemini(chunkSystem, chunk)
      const match = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          allSections.push(...(parsed.sections || []))
          allKeywords.push(...(parsed.keywords || []))
        } catch {}
      }
    }

    const titres = allSections.map(s => s.title).slice(0, 20).join(', ')
    const metaRaw = await callGemini(
      'Tu es un assistant pédagogique. Réponds UNIQUEMENT avec du JSON valide, sans markdown.',
      `Génère un titre, un plan et un résumé pour un cours dont les sections sont : ${titres}
Format: {"title":"Titre du cours","plan":[{"level":1,"text":"I. Titre"}],"summary":"Résumé en 2-3 phrases"}`
    )
    const cleanMeta = metaRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    const metaMatch = cleanMeta.match(/\{[\s\S]*\}/)
    let meta = { title: 'Cours', plan: [], summary: '' }
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[0]) } catch {}
    }

    result = JSON.stringify({
      title: meta.title,
      plan: meta.plan,
      keywords: allKeywords,
      sections: allSections,
      summary: meta.summary,
    })
  }

  await redis.setex(key, 86400, result)
  return result
}
