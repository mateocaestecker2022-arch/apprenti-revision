import Anthropic from '@anthropic-ai/sdk'
import { redis } from './redis'
import crypto from 'crypto'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  cacheKey?: string
): Promise<string> {
  const key = cacheKey || `claude:${hashContent(systemPrompt + prompt)}`

  // Vérifier le cache Redis
  const cached = await redis.get(key)
  if (cached) return cached

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const result = response.content[0].type === 'text' ? response.content[0].text : ''

  // Mettre en cache 24h
  await redis.setex(key, 86400, result)

  return result
}
