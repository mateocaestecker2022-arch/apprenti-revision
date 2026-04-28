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
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 0.2,
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

const SYSTEM_PROMPT = `Tu es un assistant pédagogique expert universitaire. Tu dois structurer ce cours en JSON SANS RIEN OMETTRE.

MISSION PRINCIPALE : Reproduire INTÉGRALEMENT le contenu du cours — pas le résumer.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre exact de la section/chapitre/article",
      "notions": [
        { "term": "Terme juridique ou clé", "definition": "Définition complète et précise, avec références légales si présentes (ex: art. 815 C. civ.)" }
      ],
      "points": [
        "Reproduis ici INTÉGRALEMENT le contenu de cette section : chaque règle, chaque article de loi cité, chaque mécanisme juridique, chaque exemple, chaque distinction (actif/passif, droits réels/personnels, etc.). Ne raccourcis RIEN.",
        "Si la section contient plusieurs sous-parties, chaque sous-partie devient un point distinct et complet."
      ],
      "retenir": "Phrase de synthèse courte de la section."
    }
  ],
  "summary": "Résumé du cours en 4-5 phrases."
}

RÈGLES ABSOLUES :
- "points" : copie TOUT le contenu de chaque section — articles de loi avec leur numéro, mécanismes juridiques complets, distinctions précises, exemples. JAMAIS de raccourcis.
- "notions" : tous les termes techniques avec définitions précises et références légales
- Chaque chapitre, sous-chapitre, article du cours original = une section distincte
- Pour un cours de droit : TOUS les articles (art. 815, art. 1832, etc.), TOUS les régimes (matrimoniaux, indivision, domaine public/privé), TOUTES les distinctions juridiques
- Ne jamais fusionner deux sections en une — crée autant de sections que le cours en contient
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

    const chunkSystem = `Tu es un assistant pédagogique expert universitaire. Transforme cette partie de cours en JSON valide SANS RIEN OMETTRE.

MISSION : Reproduire INTÉGRALEMENT le contenu — pas le résumer. Chaque article de loi, chaque mécanisme, chaque distinction doit être présent mot pour mot dans les "points".

RÈGLES ABSOLUES :
- Chaque chapitre, sous-chapitre, article du texte = une section JSON distincte (ne jamais fusionner)
- "points" : reproduis INTÉGRALEMENT le contenu — articles de loi avec numéros, règles complètes, exemples, distinctions précises. JAMAIS de résumé.
- "notions" : tous les termes techniques avec définitions complètes et références légales (art. X C. civ., etc.)
- "retenir" : une phrase synthèse courte
- N'invente rien, ne résume pas, ne saute rien

Format JSON uniquement :
{"sections":[{"title":"Titre exact du chapitre/article","notions":[{"term":"Terme","definition":"Définition complète avec référence légale si applicable"}],"points":["Contenu intégral de la section reproduit fidèlement, article par article, règle par règle."],"retenir":"Phrase synthèse."}]}
Réponds UNIQUEMENT avec le JSON valide.`

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
