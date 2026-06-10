import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from './prisma'
import crypto from 'crypto'

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) return null
  return new GoogleGenerativeAI(key)
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getClient()
  if (!client) return null
  try {
    const model = client.getGenerativeModel({ model: 'text-embedding-004' })
    const result = await model.embedContent(text.slice(0, 2048))
    return result.embedding.values
  } catch (e) {
    console.error('[RAG] Embedding failed:', e)
    return null
  }
}

function splitIntoRagChunks(text: string, chunkSize = 600): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = i + chunkSize
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + 300) end = lastNewline
    }
    const chunk = text.slice(i, end).trim()
    if (chunk) chunks.push(chunk)
    i = end
  }
  return chunks
}

export async function storeChunks(courseId: string, rawContent: string): Promise<void> {
  if (!getClient()) {
    console.warn('[RAG] GEMINI_API_KEY non défini — chunks non générés')
    return
  }
  await prisma.courseChunk.deleteMany({ where: { courseId } })
  const chunks = splitIntoRagChunks(rawContent)
  console.log(`[RAG] Génération de ${chunks.length} chunks pour cours ${courseId}`)
  for (let i = 0; i < chunks.length; i++) {
    const id = crypto.randomUUID()
    const embedding = await generateEmbedding(chunks[i])
    if (!embedding) continue
    const embeddingStr = `[${embedding.join(',')}]`
    await prisma.$executeRaw`
      INSERT INTO "CourseChunk" (id, "courseId", contenu, embedding, ordre)
      VALUES (${id}, ${courseId}, ${chunks[i]}, ${embeddingStr}::vector, ${i})
    `
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 250))
  }
  console.log(`[RAG] ${chunks.length} chunks stockés pour cours ${courseId}`)
}

export async function retrieveChunks(courseId: string, query: string, topK = 5): Promise<string[]> {
  const embedding = await generateEmbedding(query)
  if (!embedding) {
    const chunks = await prisma.courseChunk.findMany({
      where: { courseId },
      orderBy: { ordre: 'asc' },
      take: topK,
      select: { contenu: true },
    })
    return chunks.map(c => c.contenu)
  }
  const embeddingStr = `[${embedding.join(',')}]`
  try {
    const results = await prisma.$queryRaw<Array<{ contenu: string }>>`
      SELECT contenu FROM "CourseChunk"
      WHERE "courseId" = ${courseId}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `
    return results.map(r => r.contenu)
  } catch {
    const chunks = await prisma.courseChunk.findMany({
      where: { courseId },
      orderBy: { ordre: 'asc' },
      take: topK,
      select: { contenu: true },
    })
    return chunks.map(c => c.contenu)
  }
}
