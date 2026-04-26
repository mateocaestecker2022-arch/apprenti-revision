import { Queue } from 'bullmq'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const url = new URL(redisUrl)

const connection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
}

export const courseQueue = new Queue('course-processing', { connection })
