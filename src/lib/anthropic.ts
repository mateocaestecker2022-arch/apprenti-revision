import Groq from 'groq-sdk'
import { redis } from './redis'
import crypto from 'crypto'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
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

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  })

  const result = response.choices[0]?.message?.content || ''

  // Mettre en cache 24h
  await redis.setex(key, 86400, result)

  return result
}
