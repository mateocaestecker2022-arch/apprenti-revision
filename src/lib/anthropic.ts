import Groq from 'groq-sdk'
import { redis } from './redis'
import crypto from 'crypto'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const CHUNK_SIZE = 5000 // caractères par chunk

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    // Couper à la fin d'un paragraphe si possible
    let end = i + CHUNK_SIZE
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + 2000) end = lastNewline
    }
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return response.choices[0]?.message?.content || ''
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey || `groq:${hashContent(systemPrompt + prompt)}`

  // Vérifier le cache Redis
  const cached = await redis.get(key)
  if (cached) return cached

  let result: string

  // Si le contenu est court, traitement direct
  if (prompt.length <= CHUNK_SIZE) {
    result = await callGroq(systemPrompt, prompt)
  } else {
    // Traitement par chunks puis assemblage
    const chunks = splitIntoChunks(prompt)

    // Extraire les sections de chaque chunk
    const sectionPrompt = `Tu es un assistant pédagogique. Restructure cette partie de cours en JSON :
{
  "sections": [
    { "title": "Titre", "level": 1, "content": "Contenu complet et détaillé" }
  ],
  "keywords": [
    { "term": "Terme", "definition": "Définition" }
  ]
}
Réponds UNIQUEMENT avec le JSON.`

    const chunkResults: Array<{ sections: Array<{title: string, level: number, content: string}>, keywords: Array<{term: string, definition: string}> }> = []

    for (const chunk of chunks) {
      // Attendre 2s entre les chunks pour éviter le rate limit
      if (chunkResults.length > 0) await new Promise(r => setTimeout(r, 2000))
      const raw = await callGroq(sectionPrompt, chunk)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try { chunkResults.push(JSON.parse(match[0])) } catch {}
      }
    }

    // Assembler tous les chunks en un seul JSON final
    const allSections = chunkResults.flatMap(r => r.sections || [])
    const allKeywords = chunkResults.flatMap(r => r.keywords || [])

    // Générer le titre et le plan depuis l'assemblage
    const assemblePrompt = `Voici des sections extraites d'un cours. Génère un JSON avec :
- un titre général
- un plan hiérarchique
- un résumé
Format :
{
  "title": "Titre du cours",
  "plan": [{ "level": 1, "text": "I. Titre" }, { "level": 2, "text": "A. Sous-titre" }],
  "summary": "Résumé en 2-3 phrases"
}
Titres des sections : ${allSections.map(s => s.title).join(', ')}
Réponds UNIQUEMENT avec le JSON.`

    const metaRaw = await callGroq('Tu es un assistant pédagogique.', assemblePrompt)
    const metaMatch = metaRaw.match(/\{[\s\S]*\}/)
    let meta = { title: 'Cours', plan: [], summary: '' }
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[0]) } catch {}
    }

    const finalJson = {
      title: meta.title,
      plan: meta.plan,
      keywords: allKeywords,
      sections: allSections,
      summary: meta.summary,
    }

    result = JSON.stringify(finalJson)
  }

  // Mettre en cache 24h
  await redis.setex(key, 86400, result)

  return result
}
