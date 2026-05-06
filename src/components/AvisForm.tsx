'use client'

import { useState } from 'react'

export function AvisForm({ filiere }: { filiere: string }) {
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
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
        body: JSON.stringify({ content: content.trim(), anonymous, isAvis: true }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Erreur'); setStatus('error'); return }
      setStatus('sent'); setContent(''); setAnonymous(false)
    } catch { setError('Erreur réseau.'); setStatus('error') }
  }

  if (status === 'sent') return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
      <p className="text-2xl mb-1">⭐</p>
      <p className="font-semibold text-green-700 dark:text-green-400 text-sm">Merci pour ton avis !</p>
      <p className="text-xs text-green-600 dark:text-green-500 mt-1">Il est visible sur la page d&apos;accueil.</p>
      <button onClick={() => setStatus('idle')} className="mt-2 text-xs text-green-600 dark:text-green-400 underline">
        Laisser un autre avis
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Filière affiché au dessus */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
          {filiere}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">· affiché sur ta carte avis</span>
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Ton expérience avec Apprenti Révision…"
        rows={4}
        maxLength={400}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        disabled={status === 'sending'}
      />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={e => setAnonymous(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
            disabled={status === 'sending'}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">Rester anonyme</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-600">{content.length}/400</span>
          <button
            type="submit"
            disabled={status === 'sending' || content.trim().length < 5}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'sending' ? 'Envoi…' : 'Publier mon avis'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}
