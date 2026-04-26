import { redis } from './redis'
import crypto from 'crypto'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3.2'
const CHUNK_SIZE = 8000

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

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  return data.response || ''
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey || `ollama:${hashContent(systemPrompt + prompt)}`

  const cached = await redis.get(key)
  if (cached) return cached

  let result: string

  if (prompt.length <= CHUNK_SIZE) {
    result = await callOllama(`${systemPrompt}\n\n${prompt}`)
  } else {
    const chunks = splitIntoChunks(prompt)

    const chunkSystem = `Tu es un assistant pédagogique. Restructure cette partie de cours en JSON valide :
{"sections":[{"title":"Titre","level":1,"content":"Contenu complet"}],"keywords":[{"term":"Terme","definition":"Définition"}]}
Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`

    const allSections: Array<{title: string, level: number, content: string}> = []
    const allKeywords: Array<{term: string, definition: string}> = []

    for (const chunk of chunks) {
      const raw = await callOllama(`${chunkSystem}\n\n${chunk}`)
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
    const metaRaw = await callOllama(
      `Tu es un assistant pédagogique. Génère un titre, un plan et un résumé pour un cours dont les sections sont : ${titres}
Format JSON valide uniquement : {"title":"Titre","plan":[{"level":1,"text":"I. Titre"}],"summary":"Résumé en 2-3 phrases"}`
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
