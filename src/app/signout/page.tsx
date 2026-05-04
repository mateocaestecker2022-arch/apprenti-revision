'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

export default function SignOutPage() {
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / nom */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-indigo-600">Apprenti Révision</span>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </div>

          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Se déconnecter</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Tu vas être redirigé vers la page d&apos;accueil.</p>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition text-sm mb-3"
          >
            {loading ? 'Déconnexion...' : 'Confirmer la déconnexion'}
          </button>

          <a
            href="/dashboard"
            className="block w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition"
          >
            ← Retour au dashboard
          </a>
        </div>

        <p className="text-center mt-4 text-xs text-gray-400 dark:text-gray-600">
          <a href="/" className="hover:text-indigo-500 transition">Page d&apos;accueil</a>
        </p>
      </div>
    </div>
  )
}
