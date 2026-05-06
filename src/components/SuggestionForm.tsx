'use client'

import { useState } from 'react'

export function SuggestionForm() {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 5) { setError('Message trop court.'); return }
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), isAvis: false }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Erreur'); setStatus('error'); return }
      setStatus('sent'); setContent('')
    } catch { setError('Erreur réseau.'); setStatus('error') }
  }

  if (status === 'sent') return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
      <p className="font-semibold text-green-700 dark:text-green-400 text-sm">Merci pour ta suggestion !</p>
      <button onClick={() => setStatus('idle')} className="mt-2 text-xs text-green-600 dark:text-green-400 underline">
        Envoyer une autre
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Une idée, un bug, une amélioration…"
        rows={4}
        maxLength={600}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        disabled={status === 'sending'}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-600">{content.length}/600</span>
        <button
          type="submit"
          disabled={status === 'sending' || content.trim().length < 5}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'sending' ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}
