import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { groqChat } from '@/lib/groq'



export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      courses: {
        where: { status: 'ready' },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  if (folder.courses.length === 0) {
    return NextResponse.json({ error: 'Aucun cours prêt dans ce dossier' }, { status: 400 })
  }

  const subject = (folder.courses[0] as { subject?: string }).subject || 'Général'

  // Construire le contexte — max 1500 chars répartis sur les cours
  const charsPerCourse = Math.max(60, Math.floor(1500 / folder.courses.length))
  const context = folder.courses.map((course) => {
    const structured = course.structuredContent as {
      sections?: Array<{
        title: string
        notions?: Array<{ term: string; definition: string }>
        points?: string[]
        retenir?: string
      }>
    } | null

    const sections = structured?.sections ?? []
    const charsPerSection = Math.max(30, Math.floor(charsPerCourse / Math.max(1, sections.length)))

    const sectionsText = sections.map((s) => {
      const parts = [`[${s.title}]`]
      if (s.notions?.length) s.notions.slice(0, 3).forEach(n => parts.push(`${n.term}: ${n.definition}`.slice(0, Math.floor(charsPerSection / 2))))
      if (s.retenir) parts.push(s.retenir.slice(0, 60))
      return parts.join(' ')
    }).join(' | ')

    return `=== ${course.title} ===\n${sectionsText || course.rawContent.slice(0, charsPerCourse)}`
  }).join('\n\n').slice(0, 1500)

  const isLegal = subject === 'Droit'

  const prompt = isLegal
    ? `Tu es un professeur de droit niveau Licence/Master. Génère 15 exercices juridiques basés UNIQUEMENT sur le contenu ci-dessous. Style examen de droit français.

3 types d'exercices (5 de chaque) :

- "cas_pratique" : une situation de fait réaliste (3-4 lignes) avec une question juridique précise. La réponse suit le syllogisme juridique : règle de droit applicable → qualification des faits → solution. Ex: "M. Dupont achète un véhicule présenté comme neuf mais livré avec 30 000 km. Quel(s) recours peut-il exercer et sur quel fondement ?"

- "consultation" : un client expose son problème concret, tu dois le conseiller juridiquement. La réponse identifie le problème, cite le mécanisme juridique applicable et conclut. Ex: "Votre cliente Marie vous consulte : son voisin a planté des arbres à 30 cm de la limite séparative. Que lui conseillez-vous ?"

- "qualification" : une situation de fait + demander de qualifier juridiquement et d'appliquer le régime. La réponse qualifie, puis expose les effets juridiques et les droits/obligations des parties.

Règles absolues :
- Situations réalistes et variées, jamais abstraites
- Réponses complètes avec le raisonnement juridique (pas juste la conclusion)
- Basé UNIQUEMENT sur les notions présentes dans les cours fournis

JSON uniquement :
{"exercises":[{"type":"cas_pratique","question":"...","answer":"..."}]}

COURS :
${context}`
    : `Tu es un professeur de ${subject} niveau Licence/Master. Génère 15 exercices basés UNIQUEMENT sur le contenu ci-dessous.

3 types d'exercices (5 de chaque) :

- "analyse" : un texte, un énoncé ou un phénomène à analyser avec une question précise. La réponse identifie les concepts mobilisés et les articule logiquement.

- "application" : une situation ou un problème concret à résoudre en appliquant les notions du cours. La réponse applique le cadre théorique et conclut.

- "synthese" : une question de réflexion nécessitant de mobiliser et de mettre en relation plusieurs notions du cours.

Règles absolues :
- Situations concrètes et variées
- Réponses complètes avec le raisonnement (pas juste la conclusion)
- Basé UNIQUEMENT sur les notions présentes dans les cours fournis

JSON uniquement :
{"exercises":[{"type":"analyse","question":"...","answer":"..."}]}

COURS :
${context}`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await groqChat({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })

      const raw = res.choices[0]?.message?.content || ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Pas de JSON dans la réponse')

      const { exercises } = JSON.parse(match[0])
      if (!Array.isArray(exercises) || exercises.length === 0) {
        return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
      }
      // Valider que chaque exercice a les champs attendus
      const VALID_TYPES = isLegal
        ? ['cas_pratique', 'consultation', 'qualification']
        : ['analyse', 'application', 'synthese']
      const validExercises = exercises.filter(
        (e: unknown) =>
          e !== null &&
          typeof e === 'object' &&
          VALID_TYPES.includes((e as Record<string, unknown>).type as string) &&
          typeof (e as Record<string, unknown>).question === 'string' &&
          typeof (e as Record<string, unknown>).answer === 'string'
      )
      if (validExercises.length === 0) {
        return NextResponse.json({ error: 'Erreur génération — structure invalide' }, { status: 500 })
      }

      const record = await prisma.folderExercise.create({
        data: { folderId: params.id, exercises: validExercises },
      })

      return NextResponse.json({ id: record.id, exercises: validExercises })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 15000 * attempt))
        continue
      }
      console.error(`[EXERCISES] Erreur (tentative ${attempt}):`, err)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Erreur après plusieurs tentatives' }, { status: 500 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const folder = await prisma.folder.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!folder) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const record = await prisma.folderExercise.findFirst({
      where: { folderId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(record ?? null)
  } catch (error) {
    console.error('[GET /api/folders/[id]/exercises]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
