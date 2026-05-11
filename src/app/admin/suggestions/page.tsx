'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Suggestion = {
  id: string
  content: string
  public: boolean
  anonymous: boolean
  createdAt: string
  user: { name: string | null; email: string; filiere: string }
}

export default function AdminSuggestionsPage() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [tab, setTab] = useState<'suggestions' | 'bugs' | 'avis'>('suggestions')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replySent, setReplySent] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/suggestions/list')
      .then(r => {
        if (r.status === 403) { router.push('/admin/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setSuggestions(data.suggestions ?? data) })
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

  async function deleteSuggestion(id: string) {
    if (!confirm('Supprimer définitivement ce message ?')) return
    setDeleting(id)
    await fetch('/api/admin/suggestions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSuggestions(prev => prev.filter(s => s.id !== id))
    setDeleting(null)
  }

  async function sendReply(s: Suggestion) {
    if (!replyMessage.trim()) return
    setSendingReply(true)
    const originalContent = s.content.startsWith('[BUG] ') ? s.content.slice(6) : s.content
    await fetch('/api/admin/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: s.user.email,
        toName: s.user.name,
        message: replyMessage,
        originalContent,
      }),
    })
    setSendingReply(false)
    setReplyingTo(null)
    setReplyMessage('')
    setReplySent(s.id)
    setTimeout(() => setReplySent(null), 3000)
  }

  const bugs = suggestions.filter(s => !s.public && s.content.startsWith('[BUG] '))
  const privees = suggestions.filter(s => !s.public && !s.content.startsWith('[BUG] '))
  const avis = suggestions.filter(s => s.public)
  const displayed = tab === 'suggestions' ? privees : tab === 'bugs' ? bugs : avis

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">Admin</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Suggestions & Avis</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">🔒 Accès restreint</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">💬 Suggestions & Avis</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{privees.length} suggestion{privees.length !== 1 ? 's' : ''}</span>
            {' · '}
            <span className="text-red-500 font-medium">{bugs.length} bug{bugs.length !== 1 ? 's' : ''}</span>
            {' · '}
            <span className="text-green-600 dark:text-green-400 font-medium">{avis.length} avis publié{avis.length !== 1 ? 's' : ''}</span>
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
          <button
            onClick={() => setTab('suggestions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
              tab === 'suggestions'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            💡 Suggestions
            {privees.length > 0 && (
              <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs px-1.5 py-0.5 rounded-full">
                {privees.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('bugs')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
              tab === 'bugs'
                ? 'bg-white dark:bg-gray-900 text-red-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            🐛 Bugs
            {bugs.length > 0 && (
              <span className="bg-red-100 dark:bg-red-900/40 text-red-500 text-xs px-1.5 py-0.5 rounded-full">
                {bugs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('avis')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
              tab === 'avis'
                ? 'bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            ⭐ Avis publiés
            {avis.length > 0 && (
              <span className="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs px-1.5 py-0.5 rounded-full">
                {avis.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Chargement...</div>
        ) : displayed.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-14 text-center shadow-sm">
            <p className="text-4xl mb-3">{tab === 'suggestions' ? '💡' : tab === 'bugs' ? '🐛' : '⭐'}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {tab === 'suggestions' ? 'Aucune suggestion.' : tab === 'bugs' ? 'Aucun bug signalé.' : 'Aucun avis publié.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((s) => (
              <div key={s.id} className={`bg-white dark:bg-gray-900 border rounded-2xl shadow-sm overflow-hidden ${
                s.public ? 'border-green-200 dark:border-green-800' : tab === 'bugs' ? 'border-red-200 dark:border-red-900' : 'border-gray-100 dark:border-gray-800'
              }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                      {(s.user.name || s.user.email)?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.user.name || s.user.email}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{s.user.email}</span>
                    <span className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{s.user.filiere}</span>
                    {s.anonymous && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Anonyme</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {tab === 'suggestions' && (
                      <button
                        onClick={() => toggle(s.id, s.public)}
                        disabled={toggling === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
                      >
                        {toggling === s.id ? '...' : '→ Publier comme avis'}
                      </button>
                    )}
                    {tab === 'avis' && (
                      <button
                        onClick={() => toggle(s.id, s.public)}
                        disabled={toggling === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 disabled:opacity-50"
                      >
                        {toggling === s.id ? '...' : '✓ Publié · Dépublier'}
                      </button>
                    )}
                    <button
                      onClick={() => deleteSuggestion(s.id)}
                      disabled={deleting === s.id}
                      className="text-xs px-2 py-1.5 rounded-lg font-medium transition text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      title="Supprimer"
                    >
                      {deleting === s.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>

                {/* Contenu */}
                <div className="px-5 py-4">
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {s.content.startsWith('[BUG] ') ? s.content.slice(6) : s.content}
                  </p>
                </div>

                {/* Zone réponse */}
                {tab !== 'avis' && (
                  <div className="px-5 pb-4">
                    {replySent === s.id ? (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Réponse envoyée à {s.user.email}</p>
                    ) : replyingTo === s.id ? (
                      <div className="border dark:border-gray-700 rounded-xl overflow-hidden mt-1">
                        <textarea
                          autoFocus
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          placeholder={`Répondre à ${s.user.name || s.user.email}…`}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none"
                        />
                        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-t dark:border-gray-700">
                          <button
                            onClick={() => { setReplyingTo(null); setReplyMessage('') }}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => sendReply(s)}
                            disabled={sendingReply || !replyMessage.trim()}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            {sendingReply ? 'Envoi…' : 'Envoyer →'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setReplyingTo(s.id); setReplyMessage('') }}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1"
                      >
                        ↩ Répondre par email
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
