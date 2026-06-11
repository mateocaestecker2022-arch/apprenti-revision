'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2']

interface Question {
  question: string
  pointMethode: string
  notionCle: string
}

interface Feedback {
  mention: string
  pointsForts: string[]
  ameliorations: string[]
  feedback: string
  avertissement: string
}

const MENTION_COLOR: Record<string, string> = {
  'Très bien': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  'Bien': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'Passable': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'Insuffisant': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
}

export default function QuestionsTdPage() {
  const id = useParams().id as string
  const [niveau, setNiveau] = useState('L1')
  const [difficulte, setDifficulte] = useState<'facile' | 'intermediaire' | 'avance'>('intermediaire')
  const [questions, setQuestions] = useState<Question[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [reponse, setReponse] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [avertissement, setAvertissement] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [error, setError] = useState('')

  async function generateQuestions() {
    setLoading(true)
    setError('')
    setQuestions([])
    setSelected(null)
    setReponse('')
    setFeedback(null)
    try {
      const res = await fetch(`/api/courses/${id}/questions-td`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', difficulte, niveau }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setQuestions(json.questions || [])
      setAvertissement(json.avertissement || '')
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  async function submitReponse() {
    if (selected === null) return
    const q = questions[selected]
    setLoadingFeedback(true)
    setError('')
    setFeedback(null)
    try {
      const res = await fetch(`/api/courses/${id}/questions-td`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          question: q.question,
          pointMethode: q.pointMethode,
          reponse,
          niveau,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setFeedback(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoadingFeedback(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🎓 Questions TD</span>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Configuration */}
        {questions.length === 0 && (
          <div className="text-center mb-8">
            <p className="text-5xl mb-4">🎓</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Questions de TD par difficulté</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              L&apos;IA génère 5 questions dans le style d&apos;un vrai TD, basées uniquement sur ton cours.
              Tu choisis une question, tu rédiges ta réponse, et tu reçois un feedback immédiat.
            </p>

            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">Niveau :</span>
              <div className="flex gap-1">
                {NIVEAUX.map(n => (
                  <button key={n} onClick={() => setNiveau(n)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${niveau === n ? 'bg-violet-600 text-white' : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="text-sm text-gray-500 dark:text-gray-400">Difficulté :</span>
              <div className="flex gap-2">
                {[
                  { key: 'facile', label: 'Facile', color: 'bg-green-600' },
                  { key: 'intermediaire', label: 'Intermédiaire', color: 'bg-amber-500' },
                  { key: 'avance', label: 'Avancé', color: 'bg-red-600' },
                ].map(d => (
                  <button key={d.key} onClick={() => setDifficulte(d.key as typeof difficulte)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${difficulte === d.key ? `${d.color} text-white` : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button onClick={generateQuestions} disabled={loading}
              className="bg-violet-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50">
              {loading ? 'Génération des questions...' : 'Générer les questions'}
            </button>
          </div>
        )}

        {/* Liste des questions */}
        {questions.length > 0 && selected === null && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-gray-900 dark:text-white">Choisis une question :</h2>
              <button onClick={() => setQuestions([])} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ← Retour
              </button>
            </div>

            {avertissement && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 mb-5 text-xs text-amber-700 dark:text-amber-400">
                {avertissement}
              </div>
            )}

            <div className="space-y-3">
              {questions.map((q, i) => (
                <button key={i} onClick={() => setSelected(i)}
                  className="w-full text-left border dark:border-gray-700 rounded-xl p-4 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition group">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 group-hover:text-violet-700 dark:group-hover:text-violet-300">
                        {q.question}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {q.notionCle}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Réponse à une question */}
        {questions.length > 0 && selected !== null && !feedback && (
          <div>
            <button onClick={() => { setSelected(null); setReponse('') }}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-6 block">
              ← Changer de question
            </button>

            <div className="border dark:border-gray-700 rounded-xl p-5 mb-5">
              <p className="text-xs text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wide mb-2">
                Question {selected + 1}
              </p>
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-3">{questions[selected].question}</p>
              <details className="text-sm text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 text-xs">
                  Voir le point de méthode attendu
                </summary>
                <p className="mt-2 text-xs bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-lg p-3">
                  {questions[selected].pointMethode}
                </p>
              </details>
            </div>

            <textarea
              value={reponse}
              onChange={e => setReponse(e.target.value)}
              rows={10}
              placeholder="Rédige ta réponse ici..."
              className="w-full border dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
            />
            <p className="text-xs text-gray-400 mb-4 text-right">{reponse.length} caractères</p>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button onClick={submitReponse} disabled={loadingFeedback || reponse.trim().length < 20}
              className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700 transition disabled:opacity-50">
              {loadingFeedback ? 'Analyse de ta réponse...' : 'Soumettre ma réponse'}
            </button>
          </div>
        )}

        {/* Feedback */}
        {feedback && selected !== null && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-gray-900 dark:text-white">Retour du chargé de TD</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${MENTION_COLOR[feedback.mention] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {feedback.mention}
              </span>
            </div>

            <div className="border dark:border-gray-700 rounded-xl p-5 mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.feedback}</p>
            </div>

            {feedback.pointsForts?.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">Points forts</p>
                <ul className="space-y-1">
                  {feedback.pointsForts.map((p, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.ameliorations?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Axes d&apos;amélioration</p>
                <ul className="space-y-1">
                  {feedback.ameliorations.map((a, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">→</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.avertissement && (
              <p className="text-xs text-gray-400 mb-5">{feedback.avertissement}</p>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="exercice_guide"
                refId={`${id}-td-${selected}`}
                contenuIA={`Q: ${questions[selected]?.question}\n\nFeedback: ${feedback.feedback}`}
                niveau={niveau}
              />
              <div className="flex gap-2">
                <button onClick={() => { setSelected(null); setReponse(''); setFeedback(null) }}
                  className="border dark:border-gray-700 px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Autre question
                </button>
                <button onClick={() => { setQuestions([]); setSelected(null); setReponse(''); setFeedback(null) }}
                  className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                  Nouvelle session
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
