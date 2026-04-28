import { Worker } from 'bullmq'
import { PrismaClient, Prisma } from '@prisma/client'
import crypto from 'crypto'
import { Redis } from 'ioredis'
import Groq from 'groq-sdk'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const url = new URL(redisUrl)
const connection = { host: url.hostname, port: parseInt(url.port) || 6379 }

const redis = new Redis(connection)
const prisma = new PrismaClient()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const CHUNK_SIZE = 8000 // Réduit pour que chaque chunk soit entièrement traité dans les tokens de sortie

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
      if (lastNewline > i + 1500) end = lastNewline
    }
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function callGroq(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })
      return res.choices[0]?.message?.content || ''
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 429) {
        console.log(`[Worker] Rate limit Groq, attente 15s...`)
        await sleep(15000)
      } else if (attempt < retries - 1) {
        await sleep(3000)
      } else {
        throw err
      }
    }
  }
  return ''
}

const SYSTEM_PROMPT = `Tu es un assistant pédagogique expert universitaire. Restructure ce cours dans ce format JSON exact.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre de la section",
      "notions": [
        { "term": "Terme clé", "definition": "Définition complète et précise avec contexte d'utilisation" }
      ],
      "points": [
        "Point essentiel développé en 3-5 phrases avec explications, exemples concrets et contexte.",
        "Deuxième point essentiel très développé avec causes, conséquences et mécanismes expliqués."
      ],
      "retenir": "Phrase de synthèse courte résumant l'essentiel à retenir de cette section."
    }
  ],
  "summary": "Résumé complet du cours en 4-5 phrases couvrant tous les points essentiels"
}

RÈGLES ABSOLUES :
- "notions" : termes importants avec définitions précises et complètes
- "points" : chaque point est un paragraphe de 3-5 phrases, développé avec exemples
- "retenir" : une phrase synthèse de la section
- "plan" : liste simple des titres de section
- Conserve TOUTES les informations du cours original — AUCUN chapitre, AUCUN article, AUCUNE section ne doit être omis
- Pour un cours de droit : inclus TOUS les articles de loi et TOUTES leurs subdivisions
- Réponds UNIQUEMENT avec le JSON valide`

async function processCourse(content: string): Promise<object> {
  const cacheKey = `ollama:${hashContent(SYSTEM_PROMPT + content)}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  let result: object

  if (content.length <= CHUNK_SIZE) {
    const raw = await callGroq(`${SYSTEM_PROMPT}\n\n${content}`)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    result = JSON.parse(match[0])
  } else {
    const chunks = splitIntoChunks(content)

    const chunkSystem = `Tu es un assistant pédagogique expert universitaire. Restructure cette partie de cours en JSON valide.

RÈGLES ABSOLUES :
- Inclus TOUS les chapitres, TOUS les articles, TOUTES les sections présents dans le texte — n'en oublie AUCUN
- Ne résume pas, ne saute pas de contenu : chaque élément du texte doit apparaître dans une section
- Un cours de droit doit conserver TOUS les articles de loi, TOUTES les définitions, TOUTES les subdivisions
- Chaque section doit avoir des notions clés définies, des points essentiels développés (3-5 phrases), et une phrase "à retenir"

Format JSON uniquement :
{"sections":[{"title":"Titre exact du chapitre/article","notions":[{"term":"Terme","definition":"Définition complète et précise"}],"points":["Point développé en 3-5 phrases avec exemples et contexte."],"retenir":"Phrase synthèse à retenir."}]}
Réponds UNIQUEMENT avec le JSON valide, sans texte avant ou après.`

    const allSections: Array<{title: string, notions: Array<{term: string, definition: string}>, points: string[]}> = []

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await sleep(5000) // 5s entre chunks pour éviter rate limit
      const raw = await callGroq(`${chunkSystem}\n\n${chunks[ci]}`)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          const secs = parsed.sections || []
          console.log(`[Worker] Chunk ${ci + 1}/${chunks.length} traité → ${secs.length} sections`)
          allSections.push(...secs)
        } catch (e) {
          console.error(`[Worker] Chunk ${ci + 1} JSON invalide, contenu ignoré:`, e)
        }
      } else {
        console.error(`[Worker] Chunk ${ci + 1} : aucun JSON trouvé dans la réponse`)
      }
    }

    const titres = allSections.map(s => s.title).join(', ')
    const metaRaw = await callGroq(
      `Tu es un assistant pédagogique. Génère un titre et un résumé pour un cours dont les sections sont : ${titres}
Format JSON valide uniquement : {"title":"Titre du cours","plan":["Section 1","Section 2"],"summary":"Résumé en 4-5 phrases."}`
    )
    const metaMatch = metaRaw.match(/\{[\s\S]*\}/)
    let meta: { title: string; plan: string[]; summary: string } = { title: 'Cours', plan: [], summary: '' }
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[0]) } catch {}
    }

    result = {
      title: meta.title,
      plan: meta.plan.length > 0 ? meta.plan : allSections.map(s => s.title),
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
