import { Worker } from 'bullmq'
import { PrismaClient, Prisma } from '@prisma/client'
import crypto from 'crypto'
import { Redis } from 'ioredis'
import http from 'http'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const url = new URL(redisUrl)
const connection = { host: url.hostname, port: parseInt(url.port) || 6379 }

const redis = new Redis(connection)
const prisma = new PrismaClient()

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3.2:1b'
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

function callOllama(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, prompt, stream: false })
    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 600_000 },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { response?: string }
            resolve(parsed.response || '')
          } catch { resolve('') }
        })
      }
    )
    req.setTimeout(600_000, () => { req.destroy(); reject(new Error('Ollama timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const SYSTEM_PROMPT = `Tu es un assistant pédagogique expert universitaire. Restructure ce cours en développant ABONDAMMENT chaque partie.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": [
    { "level": 1, "text": "I. Titre principal" },
    { "level": 2, "text": "A. Sous-titre" },
    { "level": 3, "text": "1. Point détaillé" }
  ],
  "keywords": [
    { "term": "Terme", "definition": "Définition complète et précise avec contexte" }
  ],
  "sections": [
    {
      "title": "Titre de la section",
      "level": 1,
      "content": "Développement complet : explications détaillées, exemples concrets, causes, conséquences, mécanismes. Minimum 5-8 phrases par section."
    }
  ],
  "summary": "Résumé complet du cours en 4-5 phrases couvrant les points essentiels"
}

IMPORTANT :
- Chaque section doit être TRÈS développée (5-8 phrases minimum, exemples, explications approfondies)
- Les définitions doivent être complètes avec contexte et usage
- Ne résume PAS, DÉVELOPPE et EXPLIQUE en détail
- Conserve TOUTES les informations du cours original`

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

    const chunkSystem = `Tu es un assistant pédagogique expert. Restructure cette partie de cours en JSON valide.
Développe ABONDAMMENT chaque section (5-8 phrases, exemples, explications détaillées). Ne résume pas, explique en profondeur.
Format JSON uniquement :
{"sections":[{"title":"Titre","level":1,"content":"Développement très détaillé avec exemples et explications approfondies"}],"keywords":[{"term":"Terme","definition":"Définition complète avec contexte"}]}
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
          structuredContent: structured as Prisma.InputJsonValue,
          keywords: (structured.keywords as Prisma.InputJsonValue) || [],
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
