'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface Question {
  question: string
  options: string[]
  answer: number
  explanation: string
}

export default function QuizPage() {
  const { id } = useParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [done, setDone] = useState(false)

  async function generateQuiz() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${id}/quiz`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la génération du quiz')
        setLoading(false)
        return
      }
      if (!data.questions || data.questions.length === 0) {
        setError('Aucune question générée, réessaie.')
        setLoading(false)
        return
      }
      const shuffled = data.questions.map((q: Question) => {
        const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
        return {
          ...q,
          options: indices.map((i) => q.options[i]),
          answer: indices.indexOf(q.answer),
        }
      })
      setQuestions(shuffled)
      setCurrent(0)
      setSelected(null)
      setAnswers([])
      setDone(false)
    } catch {
      setError('Erreur réseau, vérifie ta connexion.')
    }
    setLoading(false)
  }

  function handleAnswer(idx: number) {
    if (selected !== null) return
    setSelected(idx)
  }

  function next() {
    if (selected === null) return
    const newAnswers = [...answers, selected]
    if (current + 1 >= questions.length) {
      setAnswers(newAnswers)
      setDone(true)
    } else {
      setAnswers(newAnswers)
      setCurrent(current + 1)
      setSelected(null)
    }
  }

  const score = answers.filter((a, i) => a === questions[i]?.answer).length

  if (done) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b px-6 py-3 flex items-center gap-4">
          <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <p className="text-5xl font-bold text-indigo-600 mb-2">{score}/{questions.length}</p>
            <p className="text-gray-500">
              {score === questions.length ? '🎉 Parfait !' : score >= questions.length * 0.7 ? '👍 Bien joué !' : '📚 Continue à réviser !'}
            </p>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className={`border rounded-xl p-4 ${answers[i] === q.answer ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <p className="font-medium text-gray-900 mb-2 text-sm">{i + 1}. {q.question}</p>
                <p className="text-sm text-gray-600 mb-1">
                  Ta réponse : <span className={answers[i] === q.answer ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{q.options[answers[i]]}</span>
                </p>
                {answers[i] !== q.answer && (
                  <p className="text-sm text-green-700">Bonne réponse : {q.options[q.answer]}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">{q.explanation}</p>
              </div>
            ))}
          </div>
          <button onClick={generateQuiz} className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition">
            Nouveau quiz
          </button>
        </main>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b px-6 py-3 flex items-center gap-4">
          <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
          <h1 className="font-bold text-gray-900">Quiz</h1>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-6xl mb-4">🧠</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Teste tes connaissances</h2>
          <p className="text-gray-500 mb-8">L&apos;IA va générer 10 questions QCM basées sur ton cours.</p>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={generateQuiz}
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
            ) : error ? 'Réessayer' : 'Générer le quiz'}
          </button>
        </main>
      </div>
    )
  }

  const q = questions[current]

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-3 flex items-center gap-4">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
        <h1 className="font-bold text-gray-900">Quiz</h1>
        <span className="ml-auto text-sm text-gray-400">{current + 1} / {questions.length}</span>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Barre de progression */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }}/>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-6">{q.question}</h2>

        <div className="space-y-3 mb-6">
          {q.options.map((opt, i) => {
            let style = 'border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer'
            if (selected !== null) {
              if (i === q.answer) style = 'border-2 border-green-500 bg-green-50'
              else if (i === selected) style = 'border-2 border-red-400 bg-red-50'
              else style = 'border border-gray-200 bg-gray-50 opacity-60'
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition ${style}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {selected !== null && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm text-gray-600">
            {q.explanation}
          </div>
        )}

        <button
          onClick={next}
          disabled={selected === null}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-30 transition"
        >
          {current + 1 >= questions.length ? 'Voir les résultats' : 'Question suivante'}
        </button>
      </main>
    </div>
  )
}
