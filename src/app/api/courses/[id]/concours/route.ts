import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveChunks } from '@/lib/rag'
import { getNiveauInstruction, AI_WARNING } from '@/lib/droit'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 90000 })

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await fn() } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
      throw err
    }
  }
  throw new Error('Max retries')
}

const MODE_CONFIG: Record<string, { label: string; duree: number; query: string }> = {
  grand_oral: {
    label: 'Grand oral CRFPA',
    duree: 15,
    query: 'problématique question juridique débat thème principal',
  },
  consultation: {
    label: 'Consultation juridique',
    duree: 30,
    query: 'cas pratique situation client problème juridique applicable',
  },
  examen_blanc: {
    label: 'Examen blanc',
    duree: 60,
    query: 'dissertation commentaire plan structuré argumentaire',
  },
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { rawContent: true, niveau: true },
  })
  if (!course) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  // ── GÉNÉRATION D'UN EXERCICE CONCOURS ────────────────────────────────────
  if (action === 'generate') {
    const mode = Object.keys(MODE_CONFIG).includes(body.mode) ? body.mode : 'consultation'
    const niveau = (body.niveau as string) || course.niveau || 'L1'
    const config = MODE_CONFIG[mode]

    const chunks = await retrieveChunks(params.id, config.query, 8)
    const ragContext = chunks.length > 0 ? chunks.join('\n\n') : course.rawContent.slice(0, 5000)

    let prompt = ''

    if (mode === 'grand_oral') {
      prompt = `Tu es membre du jury CRFPA. Génère un sujet de grand oral UNIQUEMENT à partir des thèmes présents dans le cours ci-dessous.

RÈGLE ABSOLUE ANTI-INVENTION : le sujet doit porter sur une notion, règle ou problématique EXPLICITEMENT présente dans le cours. N'invente aucun arrêt ou article absent.

${getNiveauInstruction(niveau)}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "sujet": "La question posée à l'oral (formulation concours, 1-2 phrases)",
  "thematique": "Le thème juridique principal (1 phrase)",
  "axesPossibles": ["Axe 1 à développer", "Axe 2 à développer", "Axe 3 possible"],
  "piegePossible": "Une difficulté ou nuance que le jury guettera",
  "dureeMinutes": ${config.duree},
  "consigne": "Lorsque tu es prêt(e), présente ton introduction et ton plan en 3 minutes, puis développe.",
  "avertissement": "${AI_WARNING}"
}`
    } else if (mode === 'consultation') {
      prompt = `Tu es jury CRFPA. Génère un cas de consultation juridique réaliste à partir du cours ci-dessous. Un client fictif consulte un cabinet.

RÈGLE ABSOLUE ANTI-INVENTION : la situation et les règles invoquées doivent reposer UNIQUEMENT sur les notions du cours. Les faits peuvent être inventés, mais les règles applicables doivent venir du cours.

${getNiveauInstruction(niveau)}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "client": "Prénom fictif du client et situation (1 phrase)",
  "faits": "Description de la situation du client (3-5 phrases de faits concrets)",
  "question": "La question juridique précise que le client pose à l'avocat",
  "enjeuxJuridiques": ["Enjeu 1 présent dans le cours", "Enjeu 2"],
  "dureeMinutes": ${config.duree},
  "consigne": "Rédige une consultation structurée : rappel des faits, problème juridique, règle applicable (tirée du cours), application, conclusion.",
  "avertissement": "${AI_WARNING}"
}`
    } else {
      // examen_blanc
      prompt = `Tu es correcteur d'un examen de droit. Génère un sujet d'examen blanc (dissertation OU commentaire) à partir du cours ci-dessous.

RÈGLE ABSOLUE ANTI-INVENTION : le sujet doit porter sur une notion ou problématique PRÉSENTE dans le cours.

${getNiveauInstruction(niveau)}

EXTRAITS DU COURS :
${ragContext}

Génère en JSON strict :
{
  "typeExercice": "dissertation | commentaire",
  "sujet": "Intitulé complet du sujet (formulation d'examen)",
  "document": null,
  "consignes": ["Consigne 1", "Consigne 2 (barème, durée, etc.)"],
  "criteresCorrectionCRFPA": [
    "Qualité de la problématique",
    "Rigueur du syllogisme juridique",
    "Maîtrise du plan (annonce, transitions, conclusion)",
    "Exactitude juridique (références du cours)",
    "Qualité de l'expression écrite"
  ],
  "dureeMinutes": ${config.duree},
  "avertissement": "${AI_WARNING}"
}`
    }

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.6,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!parsed.avertissement) parsed.avertissement = AI_WARNING
        return { ...parsed, mode, modeLabel: config.label }
      })
      return NextResponse.json(data)
    } catch (err) {
      console.error('[CONCOURS] generate:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  // ── ÉVALUATION DE LA RÉPONSE ─────────────────────────────────────────────
  if (action === 'evaluate') {
    const { mode, sujet, reponse, niveau: niveauReponse } = body
    if (!sujet || !reponse || String(reponse).trim().length < 50) {
      return NextResponse.json({ error: 'Réponse trop courte (minimum 50 caractères)' }, { status: 400 })
    }
    const niveau = niveauReponse || course.niveau || 'L1'
    const modeLabel = MODE_CONFIG[mode]?.label || 'Concours'

    const chunks = await retrieveChunks(params.id, sujet, 5)
    const ragContext = chunks.length > 0 ? chunks.join('\n\n') : course.rawContent.slice(0, 2500)

    const prompt = `Tu es correcteur CRFPA. Évalue la prestation de l'étudiant sur cet exercice : ${modeLabel}.

${getNiveauInstruction(niveau)}

SUJET : ${sujet}

EXTRAITS DU COURS (références autorisées) :
${ragContext}

PRODUCTION DE L'ÉTUDIANT :
${String(reponse).trim().slice(0, 4000)}

Évalue selon les critères CRFPA. N'invente pas de références juridiques absentes du cours.
Génère en JSON strict :
{
  "appreciationGlobale": "Très bien | Bien | Assez bien | Passable | Insuffisant",
  "criteres": [
    { "nom": "Problématique / Introduction", "appréciation": "Bien | Passable | À retravailler", "commentaire": "..." },
    { "nom": "Syllogisme juridique", "appréciation": "...", "commentaire": "..." },
    { "nom": "Structure et plan", "appréciation": "...", "commentaire": "..." },
    { "nom": "Exactitude juridique", "appréciation": "...", "commentaire": "..." },
    { "nom": "Expression et rédaction", "appréciation": "...", "commentaire": "..." }
  ],
  "pointsForts": ["..."],
  "axesProgression": ["..."],
  "conseilPrioritaire": "Le conseil le plus important en une phrase",
  "avertissement": "${AI_WARNING}"
}`

    try {
      const data = await withRetry(async () => {
        const res = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
        const raw = res.choices[0]?.message?.content || ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Pas de JSON')
        const parsed = JSON.parse(match[0])
        if (!parsed.appreciationGlobale) throw new Error('JSON invalide')
        return parsed
      })
      return NextResponse.json(data)
    } catch (err) {
      console.error('[CONCOURS] evaluate:', err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
