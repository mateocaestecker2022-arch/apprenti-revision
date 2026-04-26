'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCoursePage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 10) {
      setError('Le cours est trop court')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erreur lors du traitement')
      setLoading(false)
      return
    }

    const { id } = await res.json()
    router.push(`/courses/${id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
        <h1 className="text-lg font-bold text-indigo-600">Nouveau cours</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Importer un cours</h2>
          <p className="text-gray-500 mb-6">
            Colle ou écris ton cours ci-dessous. L&apos;IA va le restructurer automatiquement avec un plan, des définitions et un développement détaillé.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenu du cours
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                placeholder="Colle ton cours ici...&#10;&#10;Exemple :&#10;La photosynthèse est un processus par lequel les plantes convertissent la lumière solaire en énergie chimique..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">{content.length} caractères</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || content.trim().length < 10}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  L&apos;IA restructure votre cours...
                </>
              ) : (
                'Restructurer avec l\'IA'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
