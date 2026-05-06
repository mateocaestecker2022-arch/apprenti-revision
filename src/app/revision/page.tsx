'use client'

import { useState, useEffect } from 'react'

type ReviewCard = {
  id: string
  question: string
  answer: string
  courseTitle: string
  courseId: string
  isNew: boolean
}

type Stats = { difficult: number; medium: number; mastered: number }

// ─── Écran de chargement ───────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Chargement des cartes…</p>
      </div>
    </div>
  )
}

// ─── Écran vide ────────────────────────────────────────────────────────────
function EmptyScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Révision du jour</span>
      </nav>
      <main className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-6xl mb-5">🎉</p>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Tout est à jour !</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
          Tu n&apos;as aucune carte à réviser aujourd&apos;hui.<br />
          Reviens demain ou génère des flashcards sur un cours.
        </p>
        <a
          href="/dashboard"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm"
        >
          Retour au dashboard
        </a>
      </main>
    </div>
  )
}

// ─── Écran de fin ─────────────────────────────────────────────────────────
function DoneScreen({ stats, total }: { stats: Stats; total: number }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Révision du jour</span>
      </nav>
      <main className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-6xl mb-5">🏆</p>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Session terminée !</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">
          Tu as révisé <span className="font-semibold text-indigo-600">{total} carte{total > 1 ? 's' : ''}</span> aujourd&apos;hui.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-800 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-red-500 dark:text-red-400">{stats.difficult}</p>
            <p className="text-xs text-red-400 dark:text-red-500 mt-1 font-medium">À revoir</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">demain</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-800 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-amber-500 dark:text-amber-400">{stats.medium}</p>
            <p className="text-xs text-amber-400 dark:text-amber-500 mt-1 font-medium">Moyen</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">dans 6j</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-green-100 dark:border-green-800 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-green-500 dark:text-green-400">{stats.mastered}</p>
            <p className="text-xs text-green-400 dark:text-green-500 mt-1 font-medium">Maîtrisé</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">longue durée</p>
          </div>
        </div>

        <a
          href="/dashboard"
          className="block w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm"
        >
          Retour au dashboard
        </a>
      </main>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────
export default function RevisionPage() {
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState<Stats>({ difficult: 0, medium: 0, mastered: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/flashcards/review')
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function answer(quality: 1 | 3 | 5) {
    if (submitting) return
    setSubmitting(true)

    if (quality === 1) setStats((s) => ({ ...s, difficult: s.difficult + 1 }))
    else if (quality === 3) setStats((s) => ({ ...s, medium: s.medium + 1 }))
    else setStats((s) => ({ ...s, mastered: s.mastered + 1 }))

    await fetch('/api/flashcards/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashcardId: cards[current].id, quality }),
    })

    setSubmitting(false)

    if (current + 1 >= cards.length) {
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setFlipped(false)
    }
  }

  if (loading) return <LoadingScreen />
  if (!loading && cards.length === 0) return <EmptyScreen />
  if (done) return <DoneScreen stats={stats} total={cards.length} />

  const card = cards[current]
  const progress = ((current) / cards.length) * 100

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* NAV */}
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Révision du jour</span>
        <span className="ml-auto text-sm font-semibold text-gray-500 dark:text-gray-400">
          {current + 1} <span className="text-gray-300 dark:text-gray-600">/</span> {cards.length}
        </span>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Barre de progression */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-8">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Badge cours */}
        <div className="flex items-center gap-2 mb-4">
          <a
            href={`/courses/${card.courseId}`}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            {card.courseTitle}
          </a>
          {card.isNew && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md font-medium">
              Nouvelle
            </span>
          )}
        </div>

        {/* Carte */}
        <div
          onClick={() => !flipped && setFlipped(true)}
          className={`w-full bg-white dark:bg-gray-900 border-2 rounded-2xl p-8 min-h-56 flex flex-col items-center justify-center text-center transition-all duration-200 ${
            flipped
              ? 'border-indigo-200 dark:border-indigo-700 cursor-default'
              : 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md'
          }`}
        >
          {!flipped ? (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-5 font-medium">
                Question
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white leading-relaxed">
                {card.question}
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-6">
                Clique pour voir la réponse
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-5 font-medium">
                Réponse
              </p>
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                {card.answer}
              </p>
            </>
          )}
        </div>

        {/* Boutons de réponse */}
        {flipped ? (
          <div className="grid grid-cols-3 gap-3 mt-6">
            <button
              onClick={() => answer(1)}
              disabled={submitting}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 font-semibold text-sm"
            >
              <span className="text-lg">✗</span>
              À revoir
            </button>
            <button
              onClick={() => answer(3)}
              disabled={submitting}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition disabled:opacity-50 font-semibold text-sm"
            >
              <span className="text-lg">〜</span>
              Moyen
            </button>
            <button
              onClick={() => answer(5)}
              disabled={submitting}
              className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50 font-semibold text-sm"
            >
              <span className="text-lg">✓</span>
              Maîtrisé
            </button>
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full mt-6 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm"
          >
            Voir la réponse
          </button>
        )}

        {/* Légende SM-2 discrète */}
        {flipped && (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-4">
            À revoir = demain · Moyen = dans 6j · Maîtrisé = intervalle long
          </p>
        )}
      </main>
    </div>
  )
}
