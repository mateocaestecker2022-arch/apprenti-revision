import { prisma } from './prisma'
import { groqChat } from './groq'

export interface StructurePeda {
  notions: string[]
  dependances: Array<{ notion: string; prerequis: string[] }>
  ordrePedagogique: string[]
  explication: string
}

/**
 * Calcule ou récupère depuis le cache la structure pédagogique d'un cours.
 * Utilise le modèle Methodo avec type='structure_peda' comme cache.
 */
export async function getStructurePedagogique(
  courseId: string,
  rawContent: string
): Promise<StructurePeda | null> {
  // Vérifier le cache (valide 7 jours)
  const cached = await prisma.methodo.findFirst({
    where: { courseId, type: 'structure_peda' },
    orderBy: { createdAt: 'desc' },
  })
  if (cached) {
    const age = Date.now() - new Date(cached.createdAt).getTime()
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return cached.content as unknown as StructurePeda
    }
  }

  const context = rawContent.slice(0, 5000)

  const prompt = `Tu es un expert pédagogique. Analyse ce cours de droit et identifie les dépendances entre notions.

COURS :
${context}

Génère en JSON strict :
{
  "notions": ["notion1", "notion2", "notion3"],
  "dependances": [
    { "notion": "notion2", "prerequis": ["notion1"] },
    { "notion": "notion3", "prerequis": ["notion1", "notion2"] }
  ],
  "ordrePedagogique": ["notion1", "notion2", "notion3"],
  "explication": "Pourquoi cet ordre en 2-3 phrases."
}

Règles :
- 5 à 12 notions max
- "ordrePedagogique" : du plus fondamental au plus avancé
- Basé UNIQUEMENT sur ce qui est dans le cours`

  try {
    const res = await groqChat({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })
    const raw = res.choices[0]?.message?.content || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const data = JSON.parse(match[0]) as StructurePeda
    if (!Array.isArray(data.notions) || !Array.isArray(data.ordrePedagogique)) return null

    // Mise en cache
    await prisma.methodo.create({
      data: { courseId, type: 'structure_peda', content: data as unknown as import('@prisma/client').Prisma.JsonObject },
    })
    return data
  } catch (e) {
    console.error('[PEDAGOGIE] Erreur:', e)
    return null
  }
}

/**
 * Réorganise les chunks RAG selon l'ordre pédagogique.
 */
export function reorderChunksByPeda(chunks: string[], structure: StructurePeda): string[] {
  if (!structure.ordrePedagogique.length) return chunks
  const order = structure.ordrePedagogique.map(n => n.toLowerCase())
  return [...chunks].sort((a, b) => {
    const aIdx = order.findIndex(n => a.toLowerCase().includes(n))
    const bIdx = order.findIndex(n => b.toLowerCase().includes(n))
    const ai = aIdx === -1 ? 999 : aIdx
    const bi = bIdx === -1 ? 999 : bIdx
    return ai - bi
  })
}
