'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface Exercise {
  type: 'cas_pratique' | 'consultation' | 'qualification' | 'analyse' | 'application' | 'synthese'
  question: string
  answer: string
}

interface CheckResult {
  score: 'correct' | 'partiel' | 'incorrect'
  feedback: string
}

const TYPE_LABEL: Record<Exercise['type'], string> = {
  cas_pratique: '⚖️ Cas pratique',
  consultation: '🧑‍💼 Consultation',
  qualification: '🔍 Qualification juridique',
  analyse: '🔬 Analyse',
  application: '⚙️ Application',
  synthese: '💡 Synthèse',
}

const TYPE_COLOR: Record<Exercise['type'], string> = {
  cas_pratique: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  consultation: 'bg-amber-50 text-amber-700 border-amber-200',
  qualification: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  analyse: 'bg-blue-50 text-blue-700 border-blue-200',
  application: 'bg-violet-50 text-violet-700 border-violet-200',
  synthese: 'bg-teal-50 text-teal-700 border-teal-200',
}

const SCORE_STYLE = {
  correct: { bg: 'bg-green-50 border-green-200', icon: '✅', label: 'Bonne réponse !', text: 'text-green-700' },
  partiel: { bg: 'bg-orange-50 border-orange-200', icon: '🟡', label: 'Réponse partielle', text: 'text-orange-700' },
  incorrect: { bg: 'bg-red-50 border-red-200', icon: '❌', label: 'Réponse incorrecte', text: 'text-red-700' },
}

export default function FolderExercisesPage() {
  const { id } = useParams()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [done, setDone] = useState(false)
  const [scores, setScores] = useState<CheckResult['score'][]>([])

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
      setUserAnswer('')
      setResult(null)
      setShowAnswer(false)
      setDone(false)
      setScores([])
    } catch {
      setError('Erreur réseau, vérifie ta connexion.')
    }
    setLoading(false)
  }

  async function checkAnswer() {
    if (!userAnswer.trim()) return
    setChecking(true)
    try {
      const ex = exercises[current]
      const res = await fetch(`/api/folders/${id}/exercises/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: ex.question, expectedAnswer: ex.answer, userAnswer }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ score: 'incorrect', feedback: 'Erreur lors de la correction.' })
    }
    setChecking(false)
  }

  function next() {
    const newScores = [...scores, result?.score ?? 'incorrect']
    if (current + 1 >= exercises.length) {
      setScores(newScores)
      setDone(true)
    } else {
      setScores(newScores)
      setCurrent(current + 1)
      setUserAnswer('')
      setResult(null)
      setShowAnswer(false)
    }
  }

  const correctCount = scores.filter(s => s === 'correct').length
  const partielCount = scores.filter(s => s === 'partiel').length

  // Écran de fin
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <a href={`/folders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au dossier</a>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-6xl mb-4">🎓</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session terminée !</h2>
          <p className="text-gray-500 mb-6">{exercises.length} exercices complétés</p>
          <div className="flex justify-center gap-6 mb-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{correctCount}</p>
              <p className="text-sm text-gray-500">Correct</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">{partielCount}</p>
              <p className="text-sm text-gray-500">Partiel</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{exercises.length - correctCount - partielCount}</p>
              <p className="text-sm text-gray-500">Incorrect</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setCurrent(0); setUserAnswer(''); setResult(null); setShowAnswer(false); setDone(false); setScores([]) }}
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
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Exercices pratiques</h2>
          <p className="text-gray-500 mb-2">Exercices générés depuis les cours du dossier.</p>
          <p className="text-gray-400 text-sm mb-8">Tu rédiges ta réponse, l&apos;IA te corrige.</p>
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
  const scoreStyle = result ? SCORE_STYLE[result.score] : null

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href={`/folders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au dossier</a>
          <h1 className="font-bold text-gray-900">Exercices</h1>
        </div>
        <span className="text-sm text-gray-400">{current + 1} / {exercises.length}</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Barre de progression */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${((current + 1) / exercises.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-4 ${TYPE_COLOR[ex.type]}`}>
            {TYPE_LABEL[ex.type]}
          </span>
          <p className="text-base font-semibold text-gray-900 leading-relaxed">
            {ex.question}
          </p>
        </div>

        {/* Zone de réponse */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Ta réponse
          </label>
          <textarea
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            disabled={!!result}
            placeholder="Rédige ta réponse juridique ici..."
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-500"
          />
          {!result && (
            <button
              onClick={checkAnswer}
              disabled={!userAnswer.trim() || checking}
              className="mt-3 w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-30 transition flex items-center justify-center gap-2"
            >
              {checking ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Correction en cours...
                </>
              ) : 'Vérifier ma réponse'}
            </button>
          )}
        </div>

        {/* Feedback IA */}
        {result && scoreStyle && (
          <div className={`rounded-2xl border p-5 mb-4 ${scoreStyle.bg}`}>
            <p className={`font-bold mb-2 ${scoreStyle.text}`}>
              {scoreStyle.icon} {scoreStyle.label}
            </p>
            <p className={`text-sm leading-relaxed ${scoreStyle.text}`}>{result.feedback}</p>

            {/* Réponse modèle */}
            <div className="mt-4">
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className={`text-xs font-semibold underline ${scoreStyle.text}`}
              >
                {showAnswer ? 'Masquer la correction' : 'Voir la correction complète'}
              </button>
              {showAnswer && (
                <div className="mt-3 bg-white bg-opacity-70 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Correction</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{ex.answer}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bouton suivant */}
        {result && (
          <button
            onClick={next}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            {current + 1 >= exercises.length ? 'Voir les résultats' : 'Exercice suivant →'}
          </button>
        )}
      </main>
    </div>
  )
}
