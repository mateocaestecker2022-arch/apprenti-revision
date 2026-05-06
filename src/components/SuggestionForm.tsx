'use client'

import { useState } from 'react'

export function SuggestionForm() {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 5) {
      setError('Le message doit faire au moins 5 caractères.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur serveur')
        setStatus('error')
        return
      }
      setStatus('sent')
      setContent('')
    } catch {
      setError('Erreur réseau, réessaie.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="font-semibold text-green-700 dark:text-green-400">Merci pour ton avis !</p>
        <p className="text-sm text-green-600 dark:text-green-500 mt-1">Il est maintenant visible sur la page d&apos;accueil.</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-green-600 dark:text-green-400 underline hover:no-underline"
        >
          Envoyer un autre avis
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Ton retour, suggestion ou idée d'amélioration…"
        rows={4}
        maxLength={600}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600 resize-none"
        disabled={status === 'sending'}
      />
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-600">{content.length}/600</span>
        <button
          type="submit"
          disabled={status === 'sending' || content.trim().length < 5}
          className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'sending' ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </form>
  )
}
