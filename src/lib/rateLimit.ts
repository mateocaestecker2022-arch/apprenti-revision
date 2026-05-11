import { redis } from './redis'
import crypto from 'crypto'

/**
 * Rate limiter Redis — sliding window
 * @param key     identifiant unique (ex: `login:192.168.1.1`)
 * @param max     nombre max de tentatives
 * @param windowS fenêtre en secondes
 * @returns { allowed, remaining, retryAfter }
 */
export async function rateLimit(key: string, max: number, windowS: number) {
  const now = Date.now()
  const windowMs = windowS * 1000
  const redisKey = `rl:${key}`

  // Sliding window : on stocke les timestamps des requêtes
  await redis.zremrangebyscore(redisKey, 0, now - windowMs)
  const count = await redis.zcard(redisKey)

  if (count >= max) {
    const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES')
    const oldestTs = oldest[1] ? parseInt(oldest[1]) : now
    const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  await redis.zadd(redisKey, now, `${now}-${crypto.randomUUID()}`)
  await redis.expire(redisKey, windowS)

  return { allowed: true, remaining: max - count - 1, retryAfter: 0 }
}
