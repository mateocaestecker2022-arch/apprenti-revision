'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface Exercise {
  type: 'cas_pratique' | 'consultation' | 'qualification'
  question: string
  answer: string
}

const TYPE_LABEL: Record<Exercise['type'], string> = {
  cas_pratique: '⚖️ Cas pratique',
  consultation: '🧑‍💼 Consultation',
  qualification: '🔍 Qualification juridique',
}

const TYPE_COLOR: Record<Exercise['type'], string> = {
  cas_pratique: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  consultation: 'bg-amber-50 text-amber-700 border-amber-200',
  qualification: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function FolderExercisesPage() {
  const { id } = useParams()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/folders/${id}/exercises`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la génération')
        setLoading(false)
        return
      }
      setExercises(data.exercises)
      setCurrent(0)
      setRevealed(false)
      setDone(false)
    } catch {
      setError('Erreur réseau, vérifie ta connexion.')
    }
    setLoading(false)
  }

  function next() {
    if (current + 1 >= exercises.length) {
      setDone(true)
    } else {
      setCurrent(current + 1)
      setRevealed(false)
    }
  }

  function prev() {
    if (current > 0) {
      setCurrent(current - 1)
      setRevealed(false)
    }
  }

  // Écran de fin
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <a href={`/folders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au dossier</a>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-6xl mb-4">🎓</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Session terminée !</h2>
          <p className="text-gray-500 mb-8">Tu as parcouru les {exercises.length} exercices.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setCurrent(0); setRevealed(false); setDone(false) }}
              className="border border-indigo-300 text-indigo-600 px-6 py-3 rounded-xl font-medium hover:bg-indigo-50 transition"
            >
              Recommencer
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? 'Génération...' : 'Nouveaux exercices'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Écran d'accueil
  if (exercises.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <a href={`/folders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au dossier</a>
          <h1 className="font-bold text-gray-900">Exercices du dossier</h1>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-6xl mb-4">✍️</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Exercices personnalisés</h2>
          <p className="text-gray-500 mb-2">L&apos;IA génère des exercices basés sur les cours de ce dossier.</p>
          <p className="text-gray-400 text-sm mb-8">Définitions, vrai/faux et cas pratiques — tout ce que tu dois savoir par cœur.</p>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Génération en cours...
              </>
            ) : error ? 'Réessayer' : 'Générer les exercices'}
          </button>
        </main>
      </div>
    )
  }

  const ex = exercises[current]

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href={`/folders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au dossier</a>
          <h1 className="font-bold text-gray-900">Exercices</h1>
        </div>
        <span className="text-sm text-gray-400">{current + 1} / {exercises.length}</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Barre de progression */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${((current + 1) / exercises.length) * 100}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          {/* Badge type */}
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-4 ${TYPE_COLOR[ex.type]}`}>
            {TYPE_LABEL[ex.type]}
          </span>

          {/* Question */}
          <p className="text-lg font-semibold text-gray-900 leading-relaxed mb-6">
            {ex.question}
          </p>

          {/* Réponse cachée / révélée */}
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition text-sm font-medium"
            >
              Voir la réponse
            </button>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Réponse</p>
              <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">{ex.answer}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={current === 0}
            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-30 transition"
          >
            ← Précédent
          </button>
          <button
            onClick={next}
            disabled={!revealed}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-30 transition"
          >
            {current + 1 >= exercises.length ? 'Terminer' : 'Suivant →'}
          </button>
        </div>

        {/* Générer de nouveaux */}
        <div className="mt-6 text-center">
          <button
            onClick={generate}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-indigo-600 transition underline"
          >
            {loading ? 'Génération...' : 'Générer de nouveaux exercices'}
          </button>
        </div>
      </main>
    </div>
  )
}
