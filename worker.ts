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

const CHUNK_SIZE = 2500 // Réduit pour compenser les prompts plus longs (vocabulaire juridique)

// Whitelist stricte des articles vérifiés — aucun autre ne peut être affiché
const ARTICLES_WHITELIST = [
  { article: 'Art. 2284 C. civ.', description: 'Responsabilité patrimoniale : toute personne est tenue de ses obligations sur l\'ensemble de ses biens présents et à venir.' },
  { article: 'Art. 2285 C. civ.', description: 'Gage commun des créanciers : les biens du débiteur sont le gage commun de ses créanciers ; le prix s\'en distribue entre eux par contribution.' },
  { article: 'Art. 815 C. civ.', description: 'Indivision : nul ne peut être contraint à demeurer dans l\'indivision ; le partage peut toujours être provoqué.' },
  { article: 'Art. 16 C. civ.', description: 'Primauté de la personne humaine et sauvegarde de la dignité de la personne contre toute atteinte.' },
  { article: 'Art. 16-1 C. civ.', description: 'Inviolabilité et non-patrimonialité du corps humain : chacun a droit au respect de son corps, qui est inviolable et hors commerce.' },
  { article: 'Art. 515-14 C. civ.', description: 'Les animaux sont des êtres vivants doués de sensibilité ; sous réserve des lois qui les protègent, les animaux sont soumis au régime des biens.' },
  { article: 'Art. 1400 C. civ.', description: 'Communauté légale : la communauté se compose activement des acquêts faits par les époux ensemble ou séparément durant le mariage.' },
]

const WHITELIST_ARTICLE_NUMBERS = new Set(['2284', '2285', '815', '16', '16-1', '515-14', '1400'])

function filterArticles(articles: Array<{ article: string; description: string }>): Array<{ article: string; description: string }> {
  return articles.filter(a => {
    const match = a.article.match(/(\d+(?:-\d+)?)/)
    return match && WHITELIST_ARTICLE_NUMBERS.has(match[1])
  })
}

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

VOCABULAIRE JURIDIQUE OBLIGATOIRE : titulaire, débiteur, créancier, universalité juridique, opposabilité, erga omnes, intuitu personae, sûreté réelle/personnelle, gage commun, subrogation réelle, nullité relative/absolue, patrimoine d'affectation. Jamais le langage courant (ex: "appartient à" → "est dévolu à", "annulé" → "frappé de nullité").

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
        { "term": "Terme juridique", "definition": "Définition EXTRAITE du texte fourni ou strictement conforme au droit français. RÈGLE ABSOLUE : si tu n'es pas certain à 100% de la définition, ne l'inclus pas. EXEMPLES CORRECTS : 'Patrimoine : universalité juridique comprenant l'ensemble des droits et obligations (actif + passif) d'une personne — construction doctrinale d'Aubry et Rau, sans définition légale dans le Code civil.' / 'Indivision : situation dans laquelle plusieurs personnes (indivisaires) sont titulaires de droits de même nature sur un même bien sans division matérielle — peut résulter d'une succession, d'un achat commun ou d'un divorce.' INTERDIT ABSOLU : inventer une définition, mélanger deux notions, définition approximative ou incomplète." }
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
- Articles de loi : NE CITE AUCUN article dans les sections. Les articles sont traités séparément dans une section dédiée. INTERDIT de mentionner des numéros d'articles dans les points, notions ou définitions.
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
- "notions" : définitions EXTRAITES du texte fourni ou strictement conformes au droit français. RÈGLE ABSOLUE : si tu n'es pas certain à 100%, n'inclus pas la notion. INTERDIT ABSOLU : inventer ou approximer une définition — ex: 'Indivision = transmis par succession' (FAUX, ne jamais écrire ça). CORRECT : 'Indivision : situation dans laquelle plusieurs personnes (indivisaires) ont des droits de même nature sur un bien sans division matérielle — résulte d'une succession, achat commun ou divorce.'
- Articles de loi : NE CITE AUCUN article dans les sections. INTERDIT de mentionner des numéros d'articles dans les points, notions ou définitions.
- Vocabulaire : titulaire, débiteur, créancier, universalité, opposabilité, erga omnes, sûreté, subrogation, nullité — jamais le langage courant.
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

  // Appel 1 : enrichissement pédagogique (carte mentale détaillée, erreurs, logique, problèmes)
  try {
    await sleep(5000)
    const enrichResult = result as { title?: string; sections?: Array<{ title: string; retenir?: string; points?: string[] }> }
    const synthese = (enrichResult.sections || [])
      .slice(0, 15)
      .map(s => `- ${s.title}${s.retenir ? ' : ' + s.retenir : ''}`)
      .join('\n')

    const enrichPrompt = `Tu es un professeur de droit niveau Licence/Master. À partir de ce cours, génère en JSON :
1. "logique" : 3 phrases résumant la logique juridique d'ensemble avec vocabulaire juridique précis
2. "erreursFrequentes" : 5 erreurs classiques d'étudiants avec correction juridiquement exacte
3. "problemesJuridiques" : 3 questions d'examen type avec principe juridique et exception si applicable
4. "schema" : carte mentale DÉTAILLÉE — nœud central + 4-5 branches principales, chaque branche avec 3-4 sous-éléments précis (notions juridiques, pas juste des mots vagues)

Exemple de schema détaillé attendu :
{"root":"Le Patrimoine","branches":[{"label":"Définition","children":["Universalité juridique (actif + passif)","Construction doctrinale d'Aubry et Rau","Absence de définition légale dans le Code civil","Lien indissociable avec la personnalité juridique"]},{"label":"Caractères","children":["Unicité : une personne = un seul patrimoine","Indivisibilité : actif et passif liés","Incessibilité : ne peut être cédé entre vifs","Transmissibilité : transmis à la mort aux héritiers"]},{"label":"Rôle juridique","children":["Gage commun des créanciers (art. 2285 C. civ.)","Responsabilité patrimoniale (art. 2284 C. civ.)","Support des droits et obligations","Subrogation réelle : les biens se remplacent"]}]}

Format JSON :
{"logique":["Phrase 1","Phrase 2","Phrase 3"],"erreursFrequentes":[{"erreur":"...","correction":"..."}],"problemesJuridiques":[{"question":"...","principe":"...","exception":"..."}],"schema":{"root":"Sujet du cours","branches":[{"label":"Branche","children":["Sous-élément précis","Sous-élément précis","Sous-élément précis"]}]}}

COURS :
${synthese}`

    const enrichRaw = await callGroq(enrichPrompt)
    const enrichMatch = enrichRaw.match(/\{[\s\S]*\}/)
    if (enrichMatch) {
      const enrichData = JSON.parse(enrichMatch[0])
      result = { ...result, ...enrichData }
      console.log('[Worker] Enrichissement pédagogique généré')
    }
  } catch (e) {
    console.error('[Worker] Enrichissement échoué (non bloquant):', e)
  }

  // Appel 2 : recherche approfondie — compléments utiles pour l'examen
  try {
    await sleep(5000)
    const enrichResult2 = result as { title?: string; sections?: Array<{ title: string }> }
    const titres = (enrichResult2.sections || []).map(s => s.title).join(', ')

    const whitelistStr = ARTICLES_WHITELIST.map(a => `- ${a.article} : ${a.description}`).join('\n')

    const recherchePrompt = `Tu es un professeur de droit français niveau Licence/Master. Pour le cours sur "${enrichResult2.title || 'ce sujet'}", génère UNIQUEMENT des compléments utiles à l'examen.

RÈGLE ABSOLUE : n'inclus que ce qui est directement utile pour réussir un examen de droit — pas de culture générale, pas d'histoire, pas de détails inutiles.

Génère en JSON :
1. "jurisprudenceCles" : 2-3 arrêts ou décisions fondamentaux que tout étudiant doit connaître sur ce sujet (juridiction, date approximative, apport juridique en une phrase). Ne cite que si tu es certain à 100%.
2. "distinctionsCles" : 3-4 distinctions juridiques fondamentales à maîtriser pour l'examen (ex: "Droit réel vs droit personnel : le droit réel est opposable erga omnes, le droit personnel n'est opposable qu'au débiteur")
3. "articlesEssentiels" : sélectionne UNIQUEMENT parmi la liste ci-dessous les articles pertinents pour ce cours. INTERDIT d'inventer ou d'ajouter tout autre article. Si aucun n'est pertinent, retourne un tableau vide [].

LISTE AUTORISÉE D'ARTICLES (choisis parmi ceux-ci uniquement) :
${whitelistStr}

Format JSON :
{"jurisprudenceCles":[{"juridiction":"Cass. civ. 1re","date":"...","apport":"..."}],"distinctionsCles":[{"distinction":"A vs B","explication":"..."}],"articlesEssentiels":[{"article":"Art. X C. civ.","description":"Apport juridique exact"}]}

Sections du cours : ${titres}`

    const rechercheRaw = await callGroq(recherchePrompt)
    const rechercheMatch = rechercheRaw.match(/\{[\s\S]*\}/)
    if (rechercheMatch) {
      const rechercheData = JSON.parse(rechercheMatch[0])
      // Filtre de sécurité : ne garder que les articles de la whitelist
      if (Array.isArray(rechercheData.articlesEssentiels)) {
        const before = rechercheData.articlesEssentiels.length
        rechercheData.articlesEssentiels = filterArticles(rechercheData.articlesEssentiels)
        const after = rechercheData.articlesEssentiels.length
        if (before !== after) {
          console.log(`[Worker] Articles filtrés : ${before - after} article(s) hors whitelist supprimé(s)`)
        }
      }
      result = { ...result, ...rechercheData }
      console.log('[Worker] Recherche approfondie générée')
    }
  } catch (e) {
    console.error('[Worker] Recherche approfondie échouée (non bloquant):', e)
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
