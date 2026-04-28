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

const SYSTEM_PROMPT = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master). Tu dois structurer ce cours en JSON analytique et rigoureux.

NIVEAU EXIGÉ : Licence/Master — pas de style lycée/STMG. Chaque point doit être analytique : expliquer les enjeux, les tensions, les contradictions, les rapports de force — pas seulement décrire les faits.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre exact de la section/chapitre tel qu'il apparaît dans le texte",
      "notions": [
        { "term": "Terme clé", "definition": "Définition précise et nuancée niveau L1/Master. Cite un article ou auteur UNIQUEMENT s'il est dans le texte source." }
      ],
      "points": [
        "Analyse (pas description) : expose le mécanisme, puis ses enjeux, tensions ou contradictions. Ex : pas 'la Terreur est un outil' mais 'la Terreur constitue un instrument politique justifié par le salut public, entraînant une suspension de l'État de droit'. Montre les logiques politiques, les rapports de force, les conséquences concrètes.",
        "Chaque sous-partie = un point distinct. Précision historique et juridique : ne jamais écrire 'suffrage universel' si c'est 'suffrage universel masculin', ne jamais simplifier au détriment de l'exactitude."
      ],
      "retenir": "Formulation synthétique niveau examen L1 : analytique, précise, avec les nuances essentielles."
    }
  ],
  "summary": "Résumé analytique en 4-5 phrases : logique d'ensemble, tensions principales, continuités/ruptures entre périodes."
}

RÈGLES ABSOLUES :
- Analytique : chaque point explique POURQUOI et QUELLES CONSÉQUENCES — pas juste QUOI
- Précision : ne jamais approximer (ex: 'suffrage universel masculin' pas 'suffrage universel', 'salut public' pas 'morale')
- Nuance : montrer les contradictions (ex: Révolution cherche démocratie → produit la Terreur)
- Articles/auteurs : citer UNIQUEMENT ceux présents dans le texte source — jamais inventer
- Répétitions : chaque notion définie une seule fois
- Chaque chapitre/sous-chapitre = une section distincte, jamais fusionnée
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

    const chunkSystem = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master). Transforme cette partie de cours en JSON analytique et rigoureux.

NIVEAU EXIGÉ : Licence/Master — analytique, pas descriptif. Expliquer les enjeux, tensions, contradictions, rapports de force — pas seulement lister des faits.

RÈGLES ABSOLUES :
- Chaque chapitre/sous-chapitre du texte = une section JSON distincte (ne jamais fusionner)
- "points" : ANALYSER pas décrire — pour chaque mécanisme, expliquer POURQUOI et QUELLES CONSÉQUENCES. Montrer les logiques politiques ou juridiques, les contradictions (ex: révolution → démocratie mais aussi → Terreur)
- Précision : ne jamais approximer ('suffrage universel masculin' pas 'suffrage universel', 'salut public' pas 'morale')
- "notions" : définitions précises niveau L1/Master. Cite un article ou auteur UNIQUEMENT s'il est dans le texte source
- "retenir" : synthèse analytique une phrase, niveau examen L1
- Chaque notion définie une seule fois — pas de répétitions
- N'invente rien d'absent du texte source

Format JSON uniquement :
{"sections":[{"title":"Titre exact du chapitre","notions":[{"term":"Terme","definition":"Définition analytique précise L1/Master"}],"points":["Analyse : mécanisme + enjeux + contradictions + conséquences, style académique rigoureux."],"retenir":"Synthèse analytique précise niveau examen."}]}
Réponds UNIQUEMENT avec le JSON valide.`

    const allSections: Array<{title: string, notions: Array<{term: string, definition: string}>, points: string[]}> = []

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await sleep(5000) // 5s entre chunks
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
