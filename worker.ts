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

const SYSTEM_PROMPT = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Tu structures ce cours en JSON rigoureux et fiable.

NIVEAU EXIGÉ : Licence/Master — vocabulaire juridique précis, raisonnement de juriste, jamais de style lycée.

Retourne UNIQUEMENT ce JSON (sans texte avant ou après) :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre exact de la section tel qu'il apparaît dans le texte",
      "notions": [
        { "term": "Terme juridique", "definition": "Définition courte, précise, juridiquement correcte. Ex : 'Universalité juridique comprenant l'ensemble des droits et obligations (actif + passif) d'une personne (Aubry et Rau).' — Ne cite un article QUE s'il figure expressément dans le texte source." }
      ],
      "points": [
        "STRING uniquement (jamais un objet JSON). Expose le mécanisme juridique avec sa logique et ses conséquences. Ex : 'L'article 2284 C. civ. fonde la responsabilité patrimoniale : le débiteur répond de ses obligations sur l'ensemble de ses biens présents et futurs, constituant ainsi le gage commun des créanciers.' — ne cite cet article que s'il est dans le texte source.",
        "Autre point sous forme de STRING. Précis, sans approximation : 'suffrage universel masculin' pas 'suffrage universel', 'construction doctrinale' pas 'règle du Code civil' si ce n'est pas dans la loi."
      ],
      "retenir": "Synthèse en une phrase juridiquement exacte, utilisable en examen."
    }
  ],
  "summary": "Résumé en 4-5 phrases : logique juridique d'ensemble, principes fondamentaux, exceptions et enjeux."
}

RÈGLES ABSOLUES :
- "points" : TOUJOURS des strings — JAMAIS des objets JSON avec clés "point"/"enjeux"/"conséquences"
- Articles de loi : citer UNIQUEMENT ceux présents dans le texte source — NE JAMAIS en inventer ni en ajouter
- Définitions : courtes, précises, juridiquement exactes — pas de formulations vagues ou approximatives
- Ne pas mélanger les matières : si le texte source mélange histoire et droit, séparer clairement les sections
- Chaque notion définie une seule fois — pas de répétitions entre sections
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

    const chunkSystem = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Transforme cette partie de cours en JSON rigoureux et fiable.

NIVEAU EXIGÉ : Licence/Master — raisonnement de juriste, vocabulaire précis, jamais de style lycée.

RÈGLES ABSOLUES :
- Chaque chapitre/sous-chapitre = une section JSON distincte (ne jamais fusionner)
- "points" : TOUJOURS des strings — JAMAIS des objets JSON. Expose le mécanisme juridique avec sa logique et ses conséquences concrètes, en une phrase développée et précise
- "notions" : définitions courtes et juridiquement exactes. Ex : 'Universalité juridique (actif + passif) rattachée à la personne — théorie doctrinale d'Aubry et Rau, sans définition dans le Code civil'. Cite un article UNIQUEMENT s'il figure dans le texte source
- Articles de loi : NE JAMAIS inventer ni ajouter un article absent du texte source
- Définitions : jamais vagues — précises, utilisables en examen
- "retenir" : une phrase synthèse juridiquement exacte, niveau partiel L1
- Chaque notion définie une seule fois, pas de répétitions entre sections

Format JSON uniquement :
{"sections":[{"title":"Titre exact du chapitre","notions":[{"term":"Terme","definition":"Définition courte et juridiquement exacte"}],"points":["Mécanisme juridique + logique + conséquences concrètes, en string."],"retenir":"Synthèse précise niveau examen L1."}]}
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

  // Appel d'enrichissement : cas pratiques, articles essentiels, erreurs fréquentes
  try {
    await sleep(5000)
    const enrichResult = result as { title?: string; sections?: Array<{ title: string; retenir?: string }> }
    const synthese = (enrichResult.sections || [])
      .slice(0, 20)
      .map(s => `- ${s.title}${s.retenir ? ' : ' + s.retenir : ''}`)
      .join('\n')
    const enrichPrompt = `Tu es un professeur de droit niveau Licence. À partir de ce cours, génère en JSON :
1. "problemesJuridiques" : 3 questions juridiques classiques avec principe et exception (si applicable)
2. "articlesEssentiels" : les articles de loi UNIQUEMENT cités dans le cours ci-dessous, avec leur rôle précis
3. "erreursFrequentes" : 4 erreurs classiques d'étudiants sur ce sujet avec la correction exacte
4. "logique" : 3 idées clés résumant la logique juridique du cours en une phrase chacune

Format JSON uniquement :
{"problemesJuridiques":[{"question":"...","principe":"...","exception":"..."}],"articlesEssentiels":[{"article":"Art. X","description":"Rôle précis"}],"erreursFrequentes":[{"erreur":"...","correction":"..."}],"logique":["Idée 1","Idée 2","Idée 3"]}

COURS (sections) :
${synthese}`

    const enrichRaw = await callGroq(enrichPrompt)
    const enrichMatch = enrichRaw.match(/\{[\s\S]*\}/)
    if (enrichMatch) {
      const enrichData = JSON.parse(enrichMatch[0])
      result = { ...result, ...enrichData }
      console.log('[Worker] Enrichissement généré')
    }
  } catch (e) {
    console.error('[Worker] Enrichissement échoué (non bloquant):', e)
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
