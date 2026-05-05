'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Suggestion = {
  id: string
  content: string
  public: boolean
  createdAt: string
  user: { name: string | null; email: string; filiere: string }
}

export default function AdminSuggestionsPage() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/suggestions/list')
      .then(r => {
        if (r.status === 403) { router.push('/admin/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setSuggestions(data) })
      .finally(() => setLoading(false))
  }, [router])

  async function toggle(id: string, current: boolean) {
    setToggling(id)
    await fetch('/api/admin/suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, public: !current }),
    })
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, public: !current } : s))
    setToggling(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">Admin</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Suggestions</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">🔒 Accès restreint</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">💡 Suggestions</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} —{' '}
            <span className="text-green-600 dark:text-green-400">
              {suggestions.filter(s => s.public).length} publiée{suggestions.filter(s => s.public).length !== 1 ? 's' : ''} comme avis
            </span>
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Chargement...</div>
        ) : suggestions.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-14 text-center shadow-sm">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-gray-500 dark:text-gray-400">Aucune suggestion pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s) => (
              <div key={s.id} className={`bg-white dark:bg-gray-900 border rounded-2xl shadow-sm overflow-hidden transition ${s.public ? 'border-green-300 dark:border-green-700' : 'dark:border-gray-800'}`}>
                <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                      {(s.user.name || s.user.email)?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.user.name || 'Anonyme'}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{s.user.email}</span>
                      <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-2 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{s.user.filiere}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => toggle(s.id, s.public)}
                      disabled={toggling === s.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        s.public
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600'
                      } disabled:opacity-50`}
                    >
                      {toggling === s.id ? '...' : s.public ? '✓ Avis publié' : 'Publier comme avis'}
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {s.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
