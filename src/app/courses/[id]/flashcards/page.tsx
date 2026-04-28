'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface Card { question: string; answer: string }

export default function FlashcardsPage() {
  const { id } = useParams()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<number[]>([])
  const [unknown, setUnknown] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateCards() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${id}/flashcards`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la génération des flashcards')
        setLoading(false)
        return
      }
      if (!data.cards || data.cards.length === 0) {
        setError('Aucune carte générée, réessaie.')
        setLoading(false)
        return
      }
      setCards(data.cards)
      setCurrent(0)
      setFlipped(false)
      setKnown([])
      setUnknown([])
      setDone(false)
    } catch {
      setError('Erreur réseau, vérifie ta connexion.')
    }
    setLoading(false)
  }

  function handleKnown() {
    setKnown([...known, current])
    next()
  }

  function handleUnknown() {
    setUnknown([...unknown, current])
    next()
  }

  function next() {
    if (current + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrent(current + 1)
      setFlipped(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b px-6 py-3 flex items-center gap-4">
          <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
        </nav>
        <main className="max-w-lg mx-auto px-6 py-10 text-center">
          <p className="text-5xl mb-4">🎯</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Session terminée !</h2>
          <div className="flex gap-4 justify-center mb-8">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex-1">
              <p className="text-2xl font-bold text-green-600">{known.length}</p>
              <p className="text-sm text-green-700">Je sais ✓</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex-1">
              <p className="text-2xl font-bold text-red-500">{unknown.length}</p>
              <p className="text-sm text-red-600">À revoir</p>
            </div>
          </div>
          {unknown.length > 0 && (
            <div className="mb-6 text-left">
              <p className="font-semibold text-gray-700 mb-3 text-sm">À revoir :</p>
              <div className="space-y-2">
                {unknown.map(i => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-gray-700">
                    <p className="font-medium">{cards[i].question}</p>
                    <p className="text-gray-500 mt-1">{cards[i].answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={generateCards} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition">
            Nouvelle session
          </button>
        </main>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b px-6 py-3 flex items-center gap-4">
          <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
          <h1 className="font-bold text-gray-900">Flashcards</h1>
        </nav>
        <main className="max-w-lg mx-auto px-6 py-20 text-center">
          <p className="text-6xl mb-4">🃏</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Flashcards</h2>
          <p className="text-gray-500 mb-8">L&apos;IA va créer des cartes de révision basées sur les notions clés du cours.</p>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={generateCards}
            disabled={loading}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Génération...
              </>
            ) : error ? 'Réessayer' : 'Générer les flashcards'}
          </button>
        </main>
      </div>
    )
  }

  const card = cards[current]

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-3 flex items-center gap-4">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Retour au cours</a>
        <h1 className="font-bold text-gray-900">Flashcards</h1>
        <span className="ml-auto text-sm text-gray-400">{current + 1} / {cards.length}</span>
      </nav>
      <main className="max-w-lg mx-auto px-6 py-10">
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${((current + 1) / cards.length) * 100}%` }}/>
        </div>

        {/* Carte */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="border-2 border-gray-200 rounded-2xl p-8 min-h-48 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 transition mb-6 text-center"
        >
          {!flipped ? (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Question</p>
              <p className="text-lg font-semibold text-gray-900">{card.question}</p>
              <p className="text-xs text-gray-400 mt-6">Clique pour voir la réponse</p>
            </>
          ) : (
            <>
              <p className="text-xs text-indigo-500 uppercase tracking-widest mb-4">Réponse</p>
              <p className="text-base text-gray-700 leading-relaxed">{card.answer}</p>
            </>
          )}
        </div>

        {flipped ? (
          <div className="flex gap-3">
            <button
              onClick={handleUnknown}
              className="flex-1 border-2 border-red-300 text-red-600 py-3 rounded-xl font-medium hover:bg-red-50 transition"
            >
              ✗ À revoir
            </button>
            <button
              onClick={handleKnown}
              className="flex-1 border-2 border-green-400 text-green-700 py-3 rounded-xl font-medium hover:bg-green-50 transition"
            >
              ✓ Je sais
            </button>
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            Voir la réponse
          </button>
        )}
      </main>
    </div>
  )
}
