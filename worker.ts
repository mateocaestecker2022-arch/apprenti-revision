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

const CHUNK_SIZE = 2500

// Whitelist stricte des articles vérifiés — uniquement pour les cours de droit
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

function isLegalSubject(subject: string): boolean {
  return subject === 'Droit'
}

// ─── Prompts droit (inchangés) ───────────────────────────────────────────────

const LEGAL_SYSTEM_PROMPT = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Tu restructures ce cours en JSON selon un ordre logique par notions.

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
        { "term": "Terme juridique", "definition": "STRUCTURE OBLIGATOIRE : [nature juridique] — [mécanisme/contenu] — [effet ou conséquence juridique]. Exemple : 'Patrimoine : universalité juridique (nature) comprenant l'ensemble des droits et obligations d'une personne, actif et passif indissociables (mécanisme) — sert de gage commun aux créanciers et lie la personne à ses obligations (effet).' / 'Subrogation réelle : mécanisme (nature) par lequel un bien nouveau prend la place d'un bien ancien dans un patrimoine en conservant son régime juridique (mécanisme) — ex: l'indemnité d'assurance se substitue au bien détruit (effet).' / 'Indivision : situation (nature) dans laquelle plusieurs indivisaires sont titulaires de droits de même nature sur un bien sans division matérielle (mécanisme) — résulte d'une succession, achat commun ou divorce (origine).'" }
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
- Articles de loi : NE CITE AUCUN article dans les sections. INTERDIT de mentionner des numéros d'articles dans les points, notions ou définitions.
- "points" : TOUJOURS des strings, JAMAIS des objets JSON
- Chaque notion définie une seule fois
- Réponds UNIQUEMENT avec le JSON valide

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE : [nature juridique] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS — vaut mieux moins de notions que des définitions fausses
- INTERDIT ABSOLU : définition circulaire (ex: "Sûreté réelle : garantie réelle" — FAUX, trop vague), définition incomplète (ex: "Subrogation : remplacement" — FAUX), mélanger deux notions distinctes
- La définition doit permettre à un étudiant de reconnaître et distinguer la notion à l'examen sans ambiguïté`

const LEGAL_CHUNK_SYSTEM = `Tu es un assistant pédagogique de niveau universitaire (Licence/Master droit). Transforme cette partie de cours en JSON rigoureux.

NIVEAU EXIGÉ : Licence/Master — raisonnement de juriste, vocabulaire précis.

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE pour chaque définition : [nature juridique] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS — vaut mieux moins de notions que des définitions fausses
- INTERDIT ABSOLU : définition circulaire (ex: "Sûreté réelle : garantie réelle" — FAUX), définition d'un seul mot (ex: "Subrogation : remplacement" — FAUX), mélanger deux notions
- EXEMPLES CORRECTS :
  * "Patrimoine : universalité juridique (nature) comprenant l'ensemble des droits et obligations d'une personne, actif et passif indissociables (mécanisme) — sert de gage commun aux créanciers (effet)."
  * "Subrogation réelle : mécanisme (nature) par lequel un bien nouveau prend la place d'un bien ancien dans un patrimoine en conservant son régime juridique (mécanisme) — ex: l'indemnité d'assurance se substitue au bien détruit (effet)."
  * "Indivision : situation (nature) dans laquelle plusieurs indivisaires sont titulaires de droits de même nature sur un bien sans division matérielle (mécanisme) — résulte d'une succession, achat commun ou divorce."

AUTRES RÈGLES ABSOLUES :
- Structure les sections par NOTION dans l'ordre logique : définition → principes → contenu → titulaires → effets → exceptions → limites
- "points" : TOUJOURS des strings — JAMAIS des objets JSON
- Articles de loi : NE CITE AUCUN article. INTERDIT de mentionner des numéros d'articles dans les points, notions ou définitions.
- Vocabulaire : titulaire, débiteur, créancier, universalité, opposabilité, erga omnes, sûreté, subrogation, nullité — jamais le langage courant.
- "retenir" : synthèse juridiquement exacte en une phrase
- Chaque notion définie une seule fois

Format JSON uniquement :
{"sections":[{"title":"Nom de la notion","notions":[{"term":"Terme","definition":"[nature juridique] — [mécanisme/contenu] — [effet/conséquence]"}],"points":["Mécanisme + logique + conséquences en string."],"retenir":"Synthèse exacte niveau examen."}]}
Réponds UNIQUEMENT avec le JSON valide.`

// ─── Prompts génériques (autres matières) — même rigueur que le droit ────────

const SUBJECT_VOCAB: Record<string, string> = {
  'Médecine':       'physiopathologie, étiologie, sémiologie, diagnostic différentiel, traitement de première intention, pronostic, prévalence, incidence, gold standard, contre-indication',
  'Informatique':   'algorithme, complexité, instance, abstraction, encapsulation, héritage, polymorphisme, paradigme, concurrence, invariant, précondition, postcondition',
  'Histoire':       'périodisation, rupture, continuité, causalité, acteur historique, contexte, conjoncture, structure, source primaire, historiographie, interprétation',
  'Économie':       'offre, demande, équilibre, externalité, bien public, asymétrie d\'information, rente, surplus, élasticité, utilité marginale, coût d\'opportunité',
  'Sciences':       'hypothèse, variable dépendante/indépendante, protocole, réplicabilité, modèle, loi, théorème, démonstration, expérience contrôlée, marge d\'erreur',
  'Philosophie':    'concept, argument, prémisse, conclusion, syllogisme, contradiction, dialectique, ontologie, épistémologie, éthique normative, déontologie, conséquentialisme',
  'Mathématiques':  'définition, théorème, lemme, corollaire, démonstration, condition nécessaire/suffisante, ensemble, application, injectivité, surjectivité, bijectivité',
  'Général':        'concept, mécanisme, principe, application, exception, limite, enjeu',
}

function getSubjectVocab(subject: string): string {
  return SUBJECT_VOCAB[subject] || SUBJECT_VOCAB['Général']
}

function getGenericSystemPrompt(subject: string): string {
  const vocab = getSubjectVocab(subject)
  return `Tu es un assistant pédagogique de niveau universitaire (Licence/Master — ${subject}). Tu restructures ce cours en JSON selon un ordre logique par notions.

NIVEAU EXIGÉ : Licence/Master — vocabulaire disciplinaire précis, raisonnement rigoureux, jamais de style lycée.

VOCABULAIRE DISCIPLINAIRE OBLIGATOIRE (${subject}) : ${vocab}. Utilise toujours le terme technique exact — jamais le langage courant à la place du vocabulaire disciplinaire.

ORDRE LOGIQUE OBLIGATOIRE des sections (respecte cet ordre) :
1. Définition(s) centrale(s) de la matière
2. Principes fondamentaux
3. Contenu / composantes
4. Acteurs / sujets concernés
5. Rôle et effets
6. Aménagements et exceptions
7. Limites

Retourne UNIQUEMENT ce JSON :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre de la notion (ex: 'La notion de X', 'Les caractères de X')",
      "notions": [
        { "term": "Terme clé", "definition": "STRUCTURE OBLIGATOIRE : [nature/catégorie] — [mécanisme/contenu] — [effet ou conséquence]. Exemple : 'Algorithme de tri : procédure (nature) qui réorganise les éléments d'une liste selon un ordre défini (mécanisme) — son efficacité se mesure en complexité temporelle O(n log n) pour les meilleurs algorithmes comparatifs (effet).' / 'Externalité négative : effet externe (nature) par lequel l'activité d'un agent impose un coût non compensé à un tiers (mécanisme) — entraîne une surproduction par rapport à l'optimum social (conséquence).'" }
      ],
      "points": [
        "STRING uniquement — jamais un objet JSON. Développe le mécanisme avec sa logique et ses conséquences."
      ],
      "retenir": "Synthèse en une phrase disciplinairement exacte, utilisable en examen."
    }
  ],
  "summary": "Résumé en 4-5 phrases : logique d'ensemble, principes, exceptions, enjeux."
}

RÈGLES ABSOLUES :
- Ordre : structure TOUJOURS par notions dans l'ordre logique ci-dessus — pas dans l'ordre du document source
- "points" : TOUJOURS des strings, JAMAIS des objets JSON
- Chaque notion définie une seule fois
- Réponds UNIQUEMENT avec le JSON valide

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE : [nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS — vaut mieux moins de notions que des définitions fausses
- INTERDIT ABSOLU : définition circulaire (ex: "Algorithme : suite d'algorithmes" — FAUX), définition incomplète (ex: "Externalité : effet externe" — FAUX), mélanger deux notions distinctes
- La définition doit permettre à un étudiant de reconnaître et distinguer la notion à l'examen sans ambiguïté`
}

function getGenericChunkSystem(subject: string): string {
  const vocab = getSubjectVocab(subject)
  return `Tu es un assistant pédagogique de niveau universitaire (Licence/Master — ${subject}). Transforme cette partie de cours en JSON rigoureux.

NIVEAU EXIGÉ : Licence/Master — raisonnement rigoureux, vocabulaire disciplinaire précis.

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE pour chaque définition : [nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS — vaut mieux moins de notions que des définitions fausses
- INTERDIT ABSOLU : définition circulaire, définition d'un seul mot, mélanger deux notions distinctes

AUTRES RÈGLES ABSOLUES :
- Structure les sections par NOTION dans l'ordre logique : définition → principes → contenu → acteurs → effets → exceptions → limites
- "points" : TOUJOURS des strings — JAMAIS des objets JSON
- Vocabulaire disciplinaire obligatoire (${subject}) : ${vocab} — jamais le langage courant
- "retenir" : synthèse disciplinairement exacte en une phrase
- Chaque notion définie une seule fois

Format JSON uniquement :
{"sections":[{"title":"Nom de la notion","notions":[{"term":"Terme","definition":"[nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]"}],"points":["Mécanisme + logique + conséquences en string."],"retenir":"Synthèse exacte niveau examen."}]}
Réponds UNIQUEMENT avec le JSON valide.`
}

function getEnrichPrompt(subject: string, synthese: string): string {
  if (isLegalSubject(subject)) {
    return `Tu es un professeur de droit niveau Licence/Master. À partir de ce cours, génère en JSON :
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
  }

  return `Tu es un professeur de ${subject} niveau Licence/Master. À partir de ce cours, génère en JSON :
1. "logique" : 3 phrases résumant la logique d'ensemble avec vocabulaire disciplinaire précis
2. "erreursFrequentes" : 5 erreurs classiques d'étudiants avec correction disciplinairement exacte
3. "problemesJuridiques" : 3 questions d'examen type avec le principe/notion clé à mobiliser et l'exception ou nuance si applicable
4. "schema" : carte mentale DÉTAILLÉE — nœud central + 4-5 branches principales, chaque branche avec 3-4 sous-éléments précis (notions disciplinaires, pas juste des mots vagues)

Exemple de schema détaillé attendu :
{"root":"Sujet du cours","branches":[{"label":"Définitions","children":["Notion A : nature + mécanisme","Notion B : catégorie + effet","Distinction A/B","Origine ou contexte"]},{"label":"Principes","children":["Principe 1 + justification","Principe 2 + conséquence","Exception au principe 1","Limite du cadre"]},{"label":"Applications","children":["Cas type 1","Cas type 2","Erreur fréquente","Point de vigilance examen"]}]}

Format JSON :
{"logique":["Phrase 1","Phrase 2","Phrase 3"],"erreursFrequentes":[{"erreur":"...","correction":"..."}],"problemesJuridiques":[{"question":"...","principe":"...","exception":"..."}],"schema":{"root":"Sujet du cours","branches":[{"label":"Branche","children":["Sous-élément précis","Sous-élément précis","Sous-élément précis"]}]}}

COURS :
${synthese}`
}

function getRecherchePrompt(subject: string, title: string, titres: string): string {
  if (isLegalSubject(subject)) {
    const whitelistStr = ARTICLES_WHITELIST.map(a => `- ${a.article} : ${a.description}`).join('\n')
    return `Tu es un professeur de droit français niveau Licence/Master. Pour le cours sur "${title}", génère UNIQUEMENT des compléments utiles à l'examen.

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
  }

  return `Tu es un professeur de ${subject} niveau Licence/Master. Pour le cours sur "${title}", génère UNIQUEMENT des compléments utiles à l'examen.

RÈGLE ABSOLUE : n'inclus que ce qui est directement utile pour réussir un examen — pas de culture générale, pas d'anecdotes, pas de détails inutiles.

Génère en JSON :
1. "referencesCles" : 2-3 auteurs, théories ou formules fondamentaux que tout étudiant doit connaître sur ce sujet (nom, date approximative, apport en une phrase). Ne cite que si tu es certain à 100%.
2. "distinctionsCles" : 3-4 distinctions conceptuelles fondamentales à maîtriser pour l'examen (ex: "Corrélation vs causalité : la corrélation mesure une covariation statistique, la causalité implique un lien mécaniste démontré")
3. "articlesEssentiels" : retourne toujours un tableau vide [] — non applicable hors droit

Format JSON :
{"referencesCles":[{"reference":"Auteur / Théorie / Formule","description":"Apport essentiel en une phrase"}],"distinctionsCles":[{"distinction":"A vs B","explication":"..."}],"articlesEssentiels":[]}

Sections du cours : ${titres}`
}

// ─── Traitement principal ─────────────────────────────────────────────────────

async function processCourse(content: string, subject: string = 'Général'): Promise<object> {
  const cacheKey = `course:${subject}:${hashContent(content)}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  let result: object

  const systemPrompt = isLegalSubject(subject) ? LEGAL_SYSTEM_PROMPT : getGenericSystemPrompt(subject)
  const chunkSystem = isLegalSubject(subject) ? LEGAL_CHUNK_SYSTEM : getGenericChunkSystem(subject)

  if (content.length <= CHUNK_SIZE) {
    const raw = await callGroq(`${systemPrompt}\n\n${content}`)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    result = JSON.parse(match[0])
  } else {
    const chunks = splitIntoChunks(content)
    const allSections: Array<{title: string, notions: Array<{term: string, definition: string}>, points: string[]}> = []

    for (let ci = 0; ci < chunks.length; ci++) {
      if (ci > 0) await sleep(5000)
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

  // Appel 1 : enrichissement pédagogique (carte mentale, erreurs, logique, problèmes)
  try {
    await sleep(5000)
    const enrichResult = result as { title?: string; sections?: Array<{ title: string; retenir?: string; points?: string[] }> }
    const synthese = (enrichResult.sections || [])
      .slice(0, 15)
      .map(s => `- ${s.title}${s.retenir ? ' : ' + s.retenir : ''}`)
      .join('\n')

    const enrichPrompt = getEnrichPrompt(subject, synthese)
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

  // Appel 2 : compléments utiles à l'examen
  try {
    await sleep(5000)
    const enrichResult2 = result as { title?: string; sections?: Array<{ title: string }> }
    const titres = (enrichResult2.sections || []).map(s => s.title).join(', ')

    const recherchePrompt = getRecherchePrompt(subject, enrichResult2.title || 'ce sujet', titres)
    const rechercheRaw = await callGroq(recherchePrompt)
    const rechercheMatch = rechercheRaw.match(/\{[\s\S]*\}/)
    if (rechercheMatch) {
      const rechercheData = JSON.parse(rechercheMatch[0])
      // Filtre articles uniquement pour le droit
      if (isLegalSubject(subject) && Array.isArray(rechercheData.articlesEssentiels)) {
        const before = rechercheData.articlesEssentiels.length
        rechercheData.articlesEssentiels = filterArticles(rechercheData.articlesEssentiels)
        const after = rechercheData.articlesEssentiels.length
        if (before !== after) {
          console.log(`[Worker] Articles filtrés : ${before - after} article(s) hors whitelist supprimé(s)`)
        }
      }
      result = { ...result, ...rechercheData }
      console.log('[Worker] Compléments examen générés')
    }
  } catch (e) {
    console.error('[Worker] Compléments échoués (non bloquant):', e)
  }

  await redis.setex(cacheKey, 86400, JSON.stringify(result))
  return result
}

const worker = new Worker(
  'course-processing',
  async (job) => {
    const { courseId, content, subject = 'Général' } = job.data as { courseId: string; content: string; subject?: string }
    console.log(`[Worker] Processing course ${courseId} (${subject})...`)

    try {
      const structured = await processCourse(content, subject) as {
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
