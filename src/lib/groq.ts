import Groq from 'groq-sdk'
import type { ChatCompletion } from 'groq-sdk/resources/chat/completions'

// Toutes les clés API disponibles — ajouter GROQ_API_KEY_2, _3, etc. dans .env
const API_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean) as string[]

const clients = API_KEYS.map(key => new Groq({ apiKey: key, timeout: 90000 }))

type ChatParams = Parameters<Groq['chat']['completions']['create']>[0]

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
      const status = (err as { status?: number })?.status
      if (status === 429 || status === 401) {
        lastErr = err
        continue
      }
      throw err
    }
  }
  throw lastErr
}
