import { Worker } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const url = new URL(redisUrl)
const connection = { host: url.hostname, port: parseInt(url.port) || 6379 }

const redis = new Redis(connection)
const prisma = new PrismaClient()

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
  const data = await res.json() as { response?: string }
  return data.response || ''
}

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

async function processCourse(content: string): Promise<object> {
  const cacheKey = `ollama:${hashContent(SYSTEM_PROMPT + content)}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  let result: object

  if (content.length <= CHUNK_SIZE) {
    const raw = await callOllama(`${SYSTEM_PROMPT}\n\n${content}`)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    result = JSON.parse(match[0])
  } else {
    const chunks = splitIntoChunks(content)

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
    let meta: { title: string; plan: Array<{level: number; text: string}>; summary: string } = { title: 'Cours', plan: [], summary: '' }
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[0]) } catch {}
    }

    result = {
      title: meta.title,
      plan: meta.plan,
      keywords: allKeywords,
      sections: allSections,
      summary: meta.summary,
    }
  }

  await redis.setex(cacheKey, 86400, JSON.stringify(result))
  return result
}

const worker = new Worker(
  'course-processing',
  async (job) => {
    const { courseId, content } = job.data as { courseId: string; content: string }
    console.log(`[Worker] Processing course ${courseId}...`)

    try {
      const structured = await processCourse(content) as {
        title?: string
        keywords?: unknown[]
        [key: string]: unknown
      }

      await prisma.course.update({
        where: { id: courseId },
        data: {
          title: (structured.title as string) || 'Cours sans titre',
          structuredContent: structured,
          keywords: (structured.keywords as object[]) || [],
          status: 'ready',
        },
      })

      console.log(`[Worker] Course ${courseId} done`)
    } catch (err) {
      console.error(`[Worker] Error on course ${courseId}:`, err)
      await prisma.course.update({
        where: { id: courseId },
        data: { status: 'error' },
      })
    }
  },
  { connection, concurrency: 1 }
)

worker.on('completed', (job) => console.log(`Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err))

console.log('[Worker] Started, waiting for jobs...')
