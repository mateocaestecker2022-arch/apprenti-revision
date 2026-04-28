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

const SYSTEM_PROMPT = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Tu restructures ce cours en JSON selon un ordre logique par notions.

NIVEAU EXIGÉ : Licence/Master — vocabulaire juridique précis, raisonnement de juriste, jamais de style lycée.

ORDRE LOGIQUE OBLIGATOIRE des sections (respecte cet ordre) :
1. Définition(s) centrale(s) de la matière
2. Principes fondamentaux
3. Contenu / composantes (ex: actif/passif, droits réels/personnels)
4. Titulaires / sujets concernés
5. Rôle juridique et effets
6. Aménagements et exceptions
7. Limites et protections

Retourne UNIQUEMENT ce JSON :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre de la notion (ex: 'La notion de patrimoine', 'Les caractères du patrimoine')",
      "notions": [
        { "term": "Terme juridique", "definition": "Définition complète et exacte. EXEMPLES CORRECTS : 'Patrimoine : universalité juridique comprenant l'ensemble des droits et obligations (actif + passif) d'une personne — construction doctrinale d'Aubry et Rau, sans définition légale dans le Code civil.' / 'Indivision : situation dans laquelle plusieurs personnes (indivisaires) sont titulaires de droits de même nature sur un même bien sans division matérielle — peut résulter d'une succession, d'un achat commun ou d'un divorce.' INTERDIT : définitions incomplètes, affirmations fausses, articles non présents dans le texte." }
      ],
      "points": [
        "STRING uniquement — jamais un objet JSON. Développe le mécanisme juridique avec sa logique et ses conséquences."
      ],
      "retenir": "Synthèse en une phrase juridiquement exacte, utilisable en examen."
    }
  ],
  "summary": "Résumé en 4-5 phrases : logique juridique d'ensemble, principes, exceptions, enjeux."
}

RÈGLES ABSOLUES :
- Ordre : structure TOUJOURS par notions dans l'ordre logique ci-dessus — pas dans l'ordre du document source
- Articles de loi : utilise tes connaissances en droit français pour citer les articles RÉELS et VÉRIFIÉS. Ne cite un article QUE si tu es certain à 100% de son contenu et de sa correspondance avec la notion. Si tu as le moindre doute, ne le cite pas. Exemples d'articles sûrs : art. 2284 C. civ. (responsabilité patrimoniale), art. 2285 C. civ. (gage des créanciers), art. 815 C. civ. (indivision), art. 16 C. civ. (dignité humaine), art. 16-1 C. civ. (corps humain hors commerce), art. 515-14 C. civ. (animaux), art. 1400 C. civ. (communauté légale).
- "points" : TOUJOURS des strings, JAMAIS des objets JSON
- Définitions : complètes, exactes, sans affirmations fausses
- Chaque notion définie une seule fois
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

    const chunkSystem = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Transforme cette partie de cours en JSON rigoureux.

NIVEAU EXIGÉ : Licence/Master — raisonnement de juriste, vocabulaire précis.

RÈGLES ABSOLUES :
- Structure les sections par NOTION dans l'ordre logique : définition → principes → contenu → titulaires → effets → exceptions → limites
- "points" : TOUJOURS des strings — JAMAIS des objets JSON
- "notions" : définitions complètes et exactes. INTERDIT : 'Indivision = transmis par succession' (faux). CORRECT : 'Indivision : situation dans laquelle plusieurs personnes (indivisaires) ont des droits de même nature sur un bien sans division matérielle — résulte d'une succession, achat commun ou divorce.'
- Articles de loi : utilise tes connaissances en droit français pour citer les articles RÉELS. Ne cite un article QUE si tu es certain à 100% de son contenu. Si doute → ne cite pas. Articles sûrs en droit civil : art. 2284 (responsabilité), art. 2285 (gage créanciers), art. 815 (indivision), art. 16 / 16-1 (dignité/corps), art. 515-14 (animaux), art. 1400 (communauté légale).
- Définitions : complètes, sans affirmations fausses, utilisables en examen
- "retenir" : synthèse juridiquement exacte en une phrase
- Chaque notion définie une seule fois

Format JSON uniquement :
{"sections":[{"title":"Nom de la notion","notions":[{"term":"Terme","definition":"Définition complète et exacte, sans articles inventés"}],"points":["Mécanisme + logique + conséquences en string."],"retenir":"Synthèse exacte niveau examen."}]}
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
5. "schema" : carte mentale du cours avec un nœud central (le sujet du cours) et 3-5 branches principales, chacune ayant 2-3 sous-éléments

Format JSON uniquement :
{"problemesJuridiques":[{"question":"...","principe":"...","exception":"..."}],"articlesEssentiels":[{"article":"Art. X","description":"Rôle précis"}],"erreursFrequentes":[{"erreur":"...","correction":"..."}],"logique":["Idée 1","Idée 2","Idée 3"],"schema":{"root":"Sujet central","branches":[{"label":"Branche 1","children":["Sous-élément A","Sous-élément B"]},{"label":"Branche 2","children":["Sous-élément C","Sous-élément D"]}]}}

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
