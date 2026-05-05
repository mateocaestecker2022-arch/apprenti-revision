import { Worker } from 'bullmq'
import { PrismaClient, Prisma } from '@prisma/client'
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

async function callGroq(prompt: string, retries = 5): Promise<string> {
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
        const wait = 15000 * (attempt + 1) // backoff : 15s, 30s, 45s, 60s, 75s
        console.log(`[Worker] Rate limit Groq, attente ${wait / 1000}s... (tentative ${attempt + 1}/${retries})`)
        await sleep(wait)
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

// ─── Configuration par matière ────────────────────────────────────────────────

const SUBJECT_VOCAB: Record<string, string> = {
  'Médecine':       'physiopathologie, étiologie, sémiologie, diagnostic différentiel, traitement de première intention, pronostic, prévalence, incidence, gold standard, contre-indication, classification',
  'Informatique':   'algorithme, complexité, instance, abstraction, encapsulation, héritage, polymorphisme, paradigme, concurrence, invariant, précondition, postcondition',
  'Histoire':       'périodisation, rupture, continuité, causalité, acteur historique, contexte, conjoncture, structure, source primaire, historiographie, interprétation',
  'Économie':       'offre, demande, équilibre, externalité, bien public, asymétrie d\'information, rente, surplus, élasticité, utilité marginale, coût d\'opportunité',
  'Sciences':       'hypothèse, variable dépendante/indépendante, protocole, réplicabilité, modèle, loi, théorème, démonstration, expérience contrôlée, marge d\'erreur',
  'Philosophie':    'concept, argument, prémisse, conclusion, syllogisme, contradiction, dialectique, ontologie, épistémologie, éthique normative, déontologie, conséquentialisme',
  'Mathématiques':  'définition, théorème, lemme, corollaire, démonstration, condition nécessaire/suffisante, ensemble, application, injectivité, surjectivité, bijectivité',
  'Général':        'concept, mécanisme, principe, application, exception, limite, enjeu',
}

// Ordre des sections adapté à chaque discipline
const SUBJECT_SECTION_ORDER: Record<string, string> = {
  'Médecine': `1. Définition et classification de la pathologie (ex: ICFEr vs ICFEp)
2. Physiopathologie (mécanismes biologiques, cascade)
3. Étiologies et facteurs de risque
4. Signes cliniques (symptômes + signes physiques)
5. Examens complémentaires et critères diagnostiques
6. Traitement (objectifs, logique des médicaments, étapes)
7. Complications et pronostic
INTERDIT ABSOLU : ne jamais créer de sections "acteurs", "droits des patients", "système de santé" — ce n'est pas prioritaire en médecine clinique.`,

  'Informatique': `1. Définition et positionnement du concept
2. Fondements théoriques (propriétés, invariants, preuves)
3. Structure et algorithme (fonctionnement pas à pas)
4. Complexité et performance (temporelle / spatiale)
5. Implémentation et cas d'usage concrets
6. Comparaison avec d'autres approches
7. Limites et cas limites`,

  'Histoire': `1. Contexte historique (cadre chronologique et géographique)
2. Causes et facteurs explicatifs (structurels et conjoncturels)
3. Déroulement des événements (chronologie)
4. Acteurs et forces en présence
5. Conséquences immédiates et à long terme
6. Interprétations historiographiques (débats entre historiens)
7. Mémoire et héritage`,

  'Économie': `1. Définition et cadre conceptuel
2. Modèle théorique (hypothèses, agents économiques)
3. Mécanismes (offre, demande, équilibre, prix)
4. Effets et conséquences (efficacité, équité, bien-être)
5. Politiques économiques et interventions publiques
6. Limites du modèle et critiques
7. Applications empiriques et exemples concrets`,

  'Sciences': `1. Définition et positionnement du concept
2. Hypothèse et cadre théorique
3. Modèle et lois (formulation, équations si applicable)
4. Protocole expérimental et démonstration
5. Résultats, données et interprétation
6. Applications pratiques et technologiques
7. Limites, incertitudes et perspectives`,

  'Philosophie': `1. Problématique et enjeux de la question
2. Définition des concepts clés
3. Thèse principale et arguments
4. Objections et contre-thèses majeures
5. Synthèse dialectique ou dépassement
6. Positionnements des auteurs majeurs (avec dates)
7. Enjeux contemporains`,

  'Mathématiques': `1. Définitions et notations
2. Propriétés fondamentales
3. Théorèmes et démonstrations (logique de la preuve)
4. Corollaires et cas particuliers
5. Applications et exercices types
6. Contre-exemples (ce qui ne vérifie pas les conditions)
7. Liens avec d'autres notions du programme`,

  'Général': `1. Définition centrale
2. Principes fondamentaux
3. Mécanismes et fonctionnement
4. Applications concrètes
5. Limites et nuances`,
}

// Questions d'examen types par matière (pour l'enrichissement)
const SUBJECT_EXAM_QUESTIONS: Record<string, string> = {
  'Médecine':      '"problemesJuridiques" : 3 cas cliniques types niveau ECN/examen avec présentation du patient, diagnostic à poser et traitement à proposer. Structure : "Un patient de X ans consulte pour... — Quel est votre diagnostic ? — Quelle prise en charge ?"',
  'Informatique':  '"problemesJuridiques" : 3 exercices types avec un problème algorithmique ou de conception à résoudre, en précisant la notion clé à mobiliser et le piège à éviter.',
  'Histoire':      '"problemesJuridiques" : 3 questions de dissertation ou commentaire de document types, avec la problématique à traiter et le plan suggéré.',
  'Économie':      '"problemesJuridiques" : 3 exercices types (graphique offre/demande, calcul d\'élasticité, analyse de politique économique) avec la méthode de résolution.',
  'Sciences':      '"problemesJuridiques" : 3 problèmes types niveau examen avec les étapes de résolution et les formules à mobiliser.',
  'Philosophie':   '"problemesJuridiques" : 3 sujets de dissertation types avec la problématique, le plan dialectique suggéré et les auteurs à citer.',
  'Mathématiques': '"problemesJuridiques" : 3 exercices types avec énoncé, méthode de résolution et erreurs classiques à éviter.',
  'Général':       '"problemesJuridiques" : 3 questions d\'examen types avec la notion clé à mobiliser et la nuance importante.',
}

// Références/compléments par matière
const SUBJECT_REFERENCES: Record<string, string> = {
  'Médecine':      '1. "referencesCles" : 2-3 classifications ou scores cliniques incontournables (ex: NYHA pour l\'insuffisance cardiaque, score de Glasgow) avec leur utilité pratique. Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 diagnostics différentiels ou distinctions cliniques fondamentales à maîtriser (ex: "IC gauche vs IC droite : signes cliniques différents").',
  'Informatique':  '1. "referencesCles" : 2-3 algorithmes, structures de données ou théorèmes fondamentaux à connaître (auteur/nom, complexité, usage). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions techniques fondamentales (ex: "Pile vs File : LIFO vs FIFO").',
  'Histoire':      '1. "referencesCles" : 2-3 historiens ou œuvres historiographiques de référence sur ce sujet (auteur, date, thèse). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions analytiques clés (ex: "Cause structurelle vs conjoncturelle").',
  'Économie':      '1. "referencesCles" : 2-3 économistes ou théories fondamentaux liés au sujet (auteur, date, apport). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions économiques fondamentales (ex: "Court terme vs long terme en analyse de marché").',
  'Sciences':      '1. "referencesCles" : 2-3 scientifiques, lois ou expériences fondamentales liées au sujet (nom, date, apport). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions conceptuelles clés (ex: "Corrélation vs causalité").',
  'Philosophie':   '1. "referencesCles" : 2-3 auteurs et œuvres majeurs à citer sur ce sujet (auteur, œuvre, thèse en une phrase). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions conceptuelles fondamentales (ex: "Liberté négative vs liberté positive : Berlin").',
  'Mathématiques': '1. "referencesCles" : 2-3 théorèmes ou résultats fondamentaux à connaître impérativement (nom, énoncé simplifié, condition d\'application). Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions logiques clés (ex: "Condition nécessaire vs suffisante").',
  'Général':       '1. "referencesCles" : 2-3 références, auteurs ou concepts fondamentaux liés au sujet. Ne cite que si certain à 100%.\n2. "distinctionsCles" : 3-4 distinctions conceptuelles importantes à maîtriser.',
}

// Focus des QCM par matière
const SUBJECT_QUIZ_FOCUS: Record<string, string> = {
  'Médecine':      'Mélange obligatoire : au moins 6 questions de PHYSIOPATHOLOGIE (mécanismes), au moins 6 questions CLINIQUES (signes, diagnostic, classification), au moins 5 questions de TRAITEMENT (médicaments, objectifs, étapes). INTERDIT : questions sur le système de santé, les acteurs ou les droits des patients.',
  'Informatique':  'Mélange obligatoire : au moins 6 questions sur des DÉFINITIONS/PROPRIÉTÉS, au moins 6 questions d\'APPLICATION (tracer un algorithme, calculer une complexité), au moins 5 questions d\'ANALYSE (choisir la meilleure structure, corriger un bug).',
  'Histoire':      'Mélange obligatoire : au moins 5 questions sur le CONTEXTE/CAUSES, au moins 5 questions sur les ÉVÉNEMENTS/CHRONOLOGIE, au moins 5 questions sur les CONSÉQUENCES/INTERPRÉTATIONS, au moins 3 questions sur les ACTEURS clés.',
  'Économie':      'Mélange obligatoire : au moins 6 questions sur les MÉCANISMES (offre/demande, équilibre), au moins 5 questions d\'APPLICATION (calcul, graphique, analyse), au moins 5 questions sur les POLITIQUES ÉCONOMIQUES et leurs effets.',
  'Sciences':      'Mélange obligatoire : au moins 6 questions sur les CONCEPTS/LOIS, au moins 6 questions d\'APPLICATION (calcul, expérience), au moins 5 questions d\'ANALYSE (interpréter un résultat, identifier une erreur expérimentale).',
  'Philosophie':   'Mélange obligatoire : au moins 6 questions sur les CONCEPTS/DÉFINITIONS, au moins 5 questions sur les AUTEURS et leurs thèses, au moins 5 questions d\'ANALYSE (identifier un argument, détecter une contradiction), au moins 3 questions de DISSERTATION (choisir la bonne problématique).',
  'Mathématiques': 'Mélange obligatoire : au moins 6 questions sur les DÉFINITIONS/THÉORÈMES, au moins 6 questions d\'APPLICATION (calcul, démonstration courte), au moins 5 questions d\'ANALYSE (vrai/faux avec justification, contre-exemple).',
  'Général':       'Mélange obligatoire : au moins 7 questions sur des DÉFINITIONS, au moins 6 questions d\'APPLICATION, au moins 4 questions d\'ANALYSE.',
}

function getSubjectVocab(subject: string): string {
  return SUBJECT_VOCAB[subject] || SUBJECT_VOCAB['Général']
}

function getSubjectSectionOrder(subject: string): string {
  return SUBJECT_SECTION_ORDER[subject] || SUBJECT_SECTION_ORDER['Général']
}

function getGenericSystemPrompt(subject: string): string {
  const vocab = getSubjectVocab(subject)
  const order = getSubjectSectionOrder(subject)
  return `Tu es un assistant pédagogique de niveau universitaire (Licence/Master — ${subject}). Tu restructures ce cours en JSON selon un ordre logique par notions.

NIVEAU EXIGÉ : Licence/Master — vocabulaire disciplinaire précis, raisonnement rigoureux, jamais de style lycée.

VOCABULAIRE DISCIPLINAIRE OBLIGATOIRE (${subject}) : ${vocab}. Utilise toujours le terme technique exact — jamais le langage courant à la place du vocabulaire disciplinaire.

ORDRE LOGIQUE OBLIGATOIRE des sections (respecte cet ordre) :
${order}

Retourne UNIQUEMENT ce JSON :
{
  "title": "Titre du cours",
  "plan": ["Titre section 1", "Titre section 2"],
  "sections": [
    {
      "title": "Titre de la notion (ex: 'Physiopathologie de X', 'Classification de X', 'Traitement de X')",
      "notions": [
        { "term": "Terme clé", "definition": "STRUCTURE OBLIGATOIRE : [nature/catégorie] — [mécanisme/contenu] — [effet ou conséquence]." }
      ],
      "points": [
        "STRING uniquement — jamais un objet JSON. Développe le mécanisme avec sa logique et ses conséquences."
      ],
      "retenir": "Synthèse en une phrase disciplinairement exacte, utilisable en examen."
    }
  ],
  "summary": "Résumé en 4-5 phrases : logique d'ensemble, points clés à l'examen, pièges fréquents."
}

RÈGLES ABSOLUES :
- Ordre : structure TOUJOURS dans l'ordre logique ci-dessus — pas dans l'ordre du document source
- "points" : TOUJOURS des strings, JAMAIS des objets JSON
- Chaque notion définie une seule fois
- Réponds UNIQUEMENT avec le JSON valide

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE : [nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS
- INTERDIT ABSOLU : définition circulaire, définition incomplète, mélanger deux notions distinctes`
}

function getGenericChunkSystem(subject: string): string {
  const vocab = getSubjectVocab(subject)
  const order = getSubjectSectionOrder(subject)
  return `Tu es un assistant pédagogique de niveau universitaire (Licence/Master — ${subject}). Transforme cette partie de cours en JSON rigoureux.

NIVEAU EXIGÉ : Licence/Master — raisonnement rigoureux, vocabulaire disciplinaire précis.

RÈGLES ABSOLUES SUR LES DÉFINITIONS :
- Structure OBLIGATOIRE pour chaque définition : [nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]
- Si tu n'es pas certain à 100% d'une définition, NE L'INCLUS PAS
- INTERDIT ABSOLU : définition circulaire, définition d'un seul mot, mélanger deux notions distinctes

AUTRES RÈGLES ABSOLUES :
- Structure les sections dans cet ordre logique : ${order.split('\n')[0]} → ... (voir ordre complet ci-dessus)
- "points" : TOUJOURS des strings — JAMAIS des objets JSON
- Vocabulaire disciplinaire obligatoire (${subject}) : ${vocab} — jamais le langage courant
- "retenir" : synthèse disciplinairement exacte en une phrase
- Chaque notion définie une seule fois

Format JSON uniquement :
{"sections":[{"title":"Nom de la section selon l'ordre ${subject}","notions":[{"term":"Terme","definition":"[nature/catégorie] — [mécanisme/contenu] — [effet/conséquence]"}],"points":["Mécanisme + logique + conséquences en string."],"retenir":"Synthèse exacte niveau examen."}]}
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

  const examQuestions = SUBJECT_EXAM_QUESTIONS[subject] || SUBJECT_EXAM_QUESTIONS['Général']

  // Exemple de schema adapté à la matière
  const schemaExemples: Record<string, string> = {
    'Médecine':      '{"root":"Insuffisance cardiaque","branches":[{"label":"Physiopathologie","children":["↓ débit cardiaque","Activation neuro-hormonale (SRA, SNS)","Remodelage ventriculaire","Mécanismes compensateurs"]},{"label":"Classification","children":["ICFEr : FEVG < 40%","ICFEp : FEVG ≥ 50%","NYHA I à IV (dyspnée)","Aiguë vs chronique"]},{"label":"Clinique","children":["Dyspnée d\'effort puis de repos","Œdèmes des membres inférieurs","Orthopnée, dyspnée paroxystique","Râles crépitants, turgescence jugulaire"]},{"label":"Traitement","children":["IEC / ARA2 (réduction de la postcharge)","Bêtabloquants (remodelage)","Diurétiques (symptômes)","Défibrillateur si FEVG < 35%"]}]}',
    'Informatique':  '{"root":"Tri rapide (Quicksort)","branches":[{"label":"Principe","children":["Diviser pour régner","Choix du pivot","Partition autour du pivot","Récursion sur sous-tableaux"]},{"label":"Complexité","children":["Moyenne : O(n log n)","Pire cas : O(n²) si pivot mal choisi","Espace : O(log n) pile récursion","En place : pas de tableau auxiliaire"]},{"label":"Implémentation","children":["Partition de Lomuto","Partition de Hoare","Pivot médiane de 3","Cas de base : tableau de taille ≤ 1"]},{"label":"Comparaison","children":["Plus rapide que tri fusion en pratique","Moins stable que tri par insertion","Meilleur cache que tri fusion","Randomisation évite le pire cas"]}]}',
    'Histoire':      '{"root":"Révolution française (1789)","branches":[{"label":"Causes","children":["Crise financière de l\'État","Mauvaises récoltes (1788)","Idées des Lumières","Blocage des réformes par les privilégiés"]},{"label":"Déroulement","children":["États généraux (mai 1789)","Prise de la Bastille (14 juillet)","Déclaration des droits (août)","Abolition des privilèges"]},{"label":"Acteurs","children":["Tiers état / bourgeoisie","Robespierre et les Jacobins","Louis XVI","Sans-culottes parisiens"]},{"label":"Conséquences","children":["Fin de l\'Ancien Régime","Modèle pour l\'Europe","Guerres révolutionnaires","Naissance de la citoyenneté"]}]}',
    'Philosophie':   '{"root":"La liberté","branches":[{"label":"Concepts clés","children":["Liberté négative (absence de contrainte)","Liberté positive (autonomie, Kant)","Libre arbitre vs déterminisme","Liberté comme responsabilité (Sartre)"]},{"label":"Auteurs","children":["Kant : liberté = autonomie de la raison","Sartre : condamnés à être libres","Mill : liberté sauf nuire à autrui","Spinoza : liberté = nécessité comprise"]},{"label":"Objections","children":["Déterminisme (Spinoza, Laplace)","Conditionnements sociaux (Bourdieu)","Inconscient (Freud)","Liberté illusoire ?"]},{"label":"Enjeux","children":["Fondement du droit","Responsabilité morale","Politique libérale","Liberté collective vs individuelle"]}]}',
  }
  const schemaEx = schemaExemples[subject] || '{"root":"Sujet du cours","branches":[{"label":"Définitions","children":["Notion A : nature + mécanisme","Notion B : catégorie + effet","Distinction A/B","Point clé examen"]},{"label":"Mécanismes","children":["Étape 1 + logique","Étape 2 + conséquence","Exception principale","Condition d\'application"]},{"label":"Applications","children":["Cas type 1","Cas type 2","Erreur fréquente","Point de vigilance examen"]}]}'

  return `Tu es un professeur de ${subject} niveau Licence/Master. À partir de ce cours, génère en JSON :
1. "logique" : 3 phrases résumant la logique d'ensemble avec vocabulaire disciplinaire précis — ce qu'un étudiant doit avoir compris pour réussir l'examen
2. "erreursFrequentes" : 5 erreurs classiques d'étudiants en ${subject} sur ce sujet, avec correction disciplinairement exacte
3. ${examQuestions}
4. "schema" : carte mentale DÉTAILLÉE centrée sur les points clés de l'examen — nœud central + 4-5 branches principales, chaque branche avec 3-4 sous-éléments précis

Exemple de schema attendu :
${schemaEx}

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

  const referencesPrompt = SUBJECT_REFERENCES[subject] || SUBJECT_REFERENCES['Général']

  return `Tu es un professeur de ${subject} niveau Licence/Master. Pour le cours sur "${title}", génère UNIQUEMENT des compléments directement utiles à l'examen.

RÈGLE ABSOLUE : n'inclus que ce qui est utile pour réussir un examen de ${subject} — pas de culture générale hors sujet, pas d'anecdotes inutiles.

Génère en JSON :
${referencesPrompt}
3. "articlesEssentiels" : retourne toujours un tableau vide [] — non applicable en ${subject}

Format JSON :
{"referencesCles":[{"reference":"Auteur / Théorie / Classification / Formule","description":"Apport essentiel en une phrase"}],"distinctionsCles":[{"distinction":"A vs B","explication":"..."}],"articlesEssentiels":[]}

Sections du cours : ${titres}`
}

// ─── Fusion des sections identiques ──────────────────────────────────────────

function mergeDuplicateSections(
  sections: Array<{ title: string; notions: Array<{ term: string; definition: string }>; points: string[]; retenir?: string }>
): typeof sections {
  const merged: typeof sections = []
  const indexByTitle = new Map<string, number>()

  for (const section of sections) {
    const key = section.title.toLowerCase().trim()
    if (indexByTitle.has(key)) {
      const idx = indexByTitle.get(key)!
      // Fusionne les notions sans doublon (par term)
      const existingTerms = new Set(merged[idx].notions.map(n => n.term.toLowerCase()))
      for (const notion of section.notions) {
        if (!existingTerms.has(notion.term.toLowerCase())) {
          merged[idx].notions.push(notion)
          existingTerms.add(notion.term.toLowerCase())
        }
      }
      // Fusionne les points sans doublon
      const existingPoints = new Set(merged[idx].points.map(p => p.trim()))
      for (const point of section.points) {
        if (!existingPoints.has(point.trim())) {
          merged[idx].points.push(point)
        }
      }
      // Garde le premier retenir non vide
      if (!merged[idx].retenir && section.retenir) {
        merged[idx].retenir = section.retenir
      }
    } else {
      indexByTitle.set(key, merged.length)
      merged.push({ ...section, notions: [...section.notions], points: [...section.points] })
    }
  }

  return merged
}

// ─── Traitement principal ─────────────────────────────────────────────────────

async function processCourse(content: string, subject: string = 'Général'): Promise<object> {

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

    const mergedSections = mergeDuplicateSections(allSections)
    const titres = mergedSections.map(s => s.title).join(', ')
    const metaRaw = await callGroq(
      `Tu es un assistant pédagogique. Génère un titre et un résumé pour un cours dont les sections sont : ${titres}
Format JSON valide uniquement : {"title":"Titre du cours","summary":"Résumé en 4-5 phrases."}`
    )
    const metaMatch = metaRaw.match(/\{[\s\S]*\}/)
    let meta: { title: string; summary: string } = { title: 'Cours', summary: '' }
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[0]) } catch {}
    }

    result = {
      title: meta.title,
      plan: mergedSections.map(s => s.title),
      sections: mergedSections,
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
      const code = (err as { code?: string }).code
      if (code !== 'P2025') {
        // P2025 = cours supprimé pendant le traitement — pas la peine d'essayer de mettre à jour
        await prisma.course.update({
          where: { id: courseId },
          data: { status: 'error' },
        }).catch(() => {}) // ignore si supprimé entre temps
      }
    }
  },
  { connection, concurrency: 1, lockDuration: 1800000 }
)

worker.on('completed', (job) => console.log(`Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err))

console.log('[Worker] Started, waiting for jobs...')
