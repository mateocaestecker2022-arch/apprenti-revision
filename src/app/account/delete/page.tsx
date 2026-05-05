'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

export default function DeleteAccountPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm) return
    setError('')
    setLoading(true)

    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Une erreur est survenue')
      setLoading(false)
      return
    }

    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            ← Retour au dashboard
          </Link>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supprimer mon compte</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Cette action est <strong>irréversible</strong>. Tous tes cours, quiz, flashcards et données seront définitivement supprimés.
          </p>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirme ton mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mot de passe actuel"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5 accent-red-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Je comprends que toutes mes données seront supprimées définitivement et que cette action est irréversible.
            </span>
          </label>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !confirm || !password}
            className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 transition"
          >
            {loading ? 'Suppression...' : 'Supprimer définitivement mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}
