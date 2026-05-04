'use client'

import { useState } from 'react'

export function SuggestionButton() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 5) return
    setLoading(true)
    try {
      await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setDone(true)
      setContent('')
      setTimeout(() => { setDone(false); setOpen(false) }, 2500)
    } catch {
      // silencieux
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg hover:border-indigo-200 dark:hover:border-indigo-700 hidden sm:block"
      >
        💡 Suggestion
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md">
            {done ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-3">🙏</p>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Merci pour ta suggestion !</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">On en prend note pour améliorer l&apos;app.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg">💡 Suggérer une amélioration</h2>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Une idée, un bug, une fonctionnalité manquante ? Dis-nous tout.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Ex : Ce serait top de pouvoir partager un cours avec un ami..."
                    rows={5}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={loading || content.trim().length < 5}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-40 transition text-sm"
                  >
                    {loading ? 'Envoi...' : 'Envoyer ma suggestion'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
