'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const FILIERES = [
  { value: 'Droit', label: '⚖️ Droit' },
  { value: 'Médecine', label: '🏥 Médecine' },
  { value: 'Informatique', label: '💻 Informatique' },
  { value: 'Histoire', label: '📜 Histoire' },
  { value: 'Économie', label: '📊 Économie' },
  { value: 'Sciences', label: '🔬 Sciences' },
  { value: 'Philosophie', label: '💭 Philosophie' },
  { value: 'Mathématiques', label: '📐 Maths' },
  { value: 'Général', label: '📚 Autre' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [filiere, setFiliere] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filiere) {
      setError('Choisis ta filière pour continuer')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, filiere }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erreur lors de l\'inscription')
      setLoading(false)
      return
    }

    router.push('/login?registered=true')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-950 px-4 py-8">
      <div className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Créer un compte</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Commencez à réviser intelligemment</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Sélecteur de filière */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ta filière <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FILIERES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFiliere(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    filiere === f.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
