import Groq from 'groq-sdk'
import { redis } from './redis'
import crypto from 'crypto'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// llama-3.1-8b-instant : 30 000 TPM gratuit, très rapide
const MODEL = 'llama-3.1-8b-instant'
const CHUNK_SIZE = 8000 // caractères

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
      if (lastNewline > i + 2000) end = lastNewline
    }
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return response.choices[0]?.message?.content || ''
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey || `groq:${hashContent(systemPrompt + prompt)}`

  const cached = await redis.get(key)
  if (cached) return cached

  let result: string

  if (prompt.length <= CHUNK_SIZE) {
    result = await callGroq(systemPrompt, prompt)
  } else {
    const chunks = splitIntoChunks(prompt)

    const chunkSystem = `Tu es un assistant pédagogique. Restructure cette partie de cours en JSON :
{"sections":[{"title":"Titre","level":1,"content":"Contenu complet"}],"keywords":[{"term":"Terme","definition":"Définition"}]}
Réponds UNIQUEMENT avec le JSON.`

    const allSections: Array<{title: string, level: number, content: string}> = []
    const allKeywords: Array<{term: string, definition: string}> = []

    for (const chunk of chunks) {
      const raw = await callGroq(chunkSystem, chunk)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          allSections.push(...(parsed.sections || []))
          allKeywords.push(...(parsed.keywords || []))
        } catch {}
      }
    }

    const titres = allSections.map(s => s.title).slice(0, 20).join(', ')
    const metaRaw = await callGroq(
      'Tu es un assistant pédagogique. Réponds UNIQUEMENT avec du JSON.',
      `Génère un titre, un plan et un résumé pour un cours dont les sections sont : ${titres}
Format: {"title":"Titre","plan":[{"level":1,"text":"I. Titre"}],"summary":"Résumé"}`
    )
    const metaMatch = metaRaw.match(/\{[\s\S]*\}/)
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
