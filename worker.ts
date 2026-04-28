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

const CHUNK_SIZE = 3500 // Ajusté pour rester sous la limite 6000 tokens/requête Groq (input + output)

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
        max_tokens: 4500,
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

const SYSTEM_PROMPT = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Tu dois structurer ce cours en JSON fidèle au texte original.

NIVEAU D'ÉCRITURE EXIGÉ : Licence / Master — vocabulaire juridique précis, formulations académiques, style concis et rigoureux. Jamais de style lycée ou STMG.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre exact de la section/chapitre tel qu'il apparaît dans le texte",
      "notions": [
        { "term": "Terme juridique", "definition": "Définition précise niveau L1/Master. Ne cite un article de loi QUE s'il est expressément mentionné dans le texte source." }
      ],
      "points": [
        "Développement fidèle au texte source : expose chaque règle, mécanisme juridique, distinction (ex : actif/passif, droits réels/personnels) tels qu'ils figurent dans le cours. Style académique, pas de vulgarisation.",
        "Chaque sous-partie du texte original devient un point distinct. Ne fusionne pas deux idées différentes."
      ],
      "retenir": "Synthèse en une phrase juridiquement précise, niveau examen L1."
    }
  ],
  "summary": "Résumé académique du cours en 4-5 phrases, niveau L1/Master."
}

RÈGLES ABSOLUES :
- Niveau : Licence/Master uniquement — formulations juridiques précises, pas de simplification excessive
- Articles de loi : cite UNIQUEMENT ceux qui apparaissent dans le texte source — ne jamais en inventer ou en ajouter
- Répétitions : chaque notion définie une seule fois — ne pas répéter la même définition dans plusieurs sections
- Chaque chapitre/sous-chapitre du texte = une section JSON distincte, jamais fusionnée
- "points" : contenu fidèle au texte, complet, sans raccourcis ni inventions
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

    const chunkSystem = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Transforme cette partie de cours en JSON valide.

NIVEAU D'ÉCRITURE : Licence/Master — vocabulaire juridique rigoureux, style académique concis. Jamais de style lycée/STMG.

RÈGLES ABSOLUES :
- Chaque chapitre/sous-chapitre du texte = une section JSON distincte (ne jamais fusionner deux idées)
- "points" : expose fidèlement chaque règle, mécanisme, distinction du texte source. Style académique, complet, sans raccourcis.
- "notions" : termes juridiques avec définitions précises niveau L1. Cite un article de loi UNIQUEMENT s'il est dans le texte source — jamais l'inventer.
- "retenir" : une phrase synthèse juridiquement précise, niveau examen L1
- Chaque notion définie une seule fois — pas de répétitions entre sections
- N'invente aucun article de loi, aucun mécanisme absent du texte

Format JSON uniquement :
{"sections":[{"title":"Titre exact du chapitre tel qu'il apparaît dans le texte","notions":[{"term":"Terme","definition":"Définition précise L1/Master, article cité uniquement si présent dans le texte source"}],"points":["Développement fidèle au texte, style académique, complet."],"retenir":"Synthèse juridique précise."}]}
Réponds UNIQUEMENT avec le JSON valide.`

    const allSections: Array<{title: string, notions: Array<{term: string, definition: string}>, points: string[]}> = []

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await sleep(12000) // 12s entre chunks — compte Groq limité à 6000 TPM
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
