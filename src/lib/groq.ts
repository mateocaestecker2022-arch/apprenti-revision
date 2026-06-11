import Groq from 'groq-sdk'
import type { ChatCompletion } from 'groq-sdk/resources/chat/completions'

// Toutes les clés API disponibles — ajouter GROQ_API_KEY_2, _3, etc. dans .env
const API_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean) as string[]

const clients = API_KEYS.map(key => new Groq({ apiKey: key, timeout: 90000 }))

type ChatParams = Groq.Chat.ChatCompletionCreateParamsNonStreaming

/**
 * Appelle l'API Groq en basculant automatiquement sur la clé suivante
 * si la clé courante est à court de quota (429 TPD).
 * Lance une erreur 429 uniquement si toutes les clés sont épuisées.
 */
export async function groqChat(params: ChatParams): Promise<ChatCompletion> {
  let lastErr: unknown
  for (const client of clients) {
    try {
      return await client.chat.completions.create(params) as ChatCompletion
    } catch (err) {
      if ((err as { status?: number })?.status === 429) {
        lastErr = err
        continue
      }
      throw err
    }
  }
  throw lastErr
}
