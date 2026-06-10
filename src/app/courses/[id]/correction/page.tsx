'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2']

interface Critere {
  nom: string
  note: number
  pointsForts: string
  pointsFaibles: string
  suggestions: string
}

interface CorrectionResult {
  criteres: Critere[]
  noteGlobale: number
  commentaireGeneral: string
  prioriteProgression: string
  avertissement: string
}

function getColor(note: number): string {
  if (note >= 14) return 'text-green-600'
  if (note >= 10) return 'text-amber-600'
  return 'text-red-600'
}

export default function CorrectionPage() {
  const id = useParams().id as string
  const [texte, setTexte] = useState('')
  const [niveau, setNiveau] = useState('L1')
  const [result, setResult] = useState<CorrectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${id}/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte, niveau }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setResult(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Correction de rédaction</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {!result ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Correction de ta rédaction</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Colle ta copie ci-dessous. L&apos;IA la note selon une grille en 5 critères.</p>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Niveau :</span>
              <div className="flex gap-1">
                {NIVEAUX.map(n => (
                  <button
                    key={n}
                    onClick={() => setNiveau(n)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${niveau === n ? 'bg-indigo-600 text-white' : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={texte}
              onChange={e => setTexte(e.target.value)}
              maxLength={8000}
              rows={12}
              placeholder="Colle ta copie ici (minimum 50 caractères)..."
              className="w-full border dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            />
            <p className="text-xs text-gray-400 mb-4 text-right">{texte.length}/8000</p>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              onClick={submit}
              disabled={loading || texte.length < 50}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Correction en cours...' : 'Corriger ma copie'}
            </button>
          </>
        ) : (
          <>
            {/* Avertissement */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 mb-6 flex items-start gap-2">
              <span className="text-amber-500 shrink-0">⚠️</span>
              <p className="text-xs text-amber-700 dark:text-amber-400">{result.avertissement}</p>
            </div>

            {/* Note globale */}
            <div className="text-center border dark:border-gray-800 rounded-2xl p-8 mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Note globale</p>
              <p className={`text-6xl font-extrabold ${getColor(result.noteGlobale)}`}>
                {result.noteGlobale}<span className="text-2xl text-gray-400">/20</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 max-w-md mx-auto">{result.commentaireGeneral}</p>
            </div>

            {/* Critères */}
            <div className="space-y-4 mb-6">
              {result.criteres.map((c, i) => (
                <div key={i} className="border dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{c.nom}</h3>
                    <span className={`text-2xl font-extrabold ${getColor(c.note)}`}>
                      {c.note}<span className="text-sm text-gray-400">/20</span>
                    </span>
                  </div>
                  {c.pointsForts && (
                    <p className="text-sm text-green-700 dark:text-green-400 mb-1">✅ {c.pointsForts}</p>
                  )}
                  {c.pointsFaibles && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1">❌ {c.pointsFaibles}</p>
                  )}
                  {c.suggestions && (
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">💡 {c.suggestions}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Priorité */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 mb-6">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">Priorité de progression</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{result.prioriteProgression}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="correction"
                refId="correction"
                contenuIA={JSON.stringify(result).slice(0, 3000)}
                niveau={niveau}
              />
              <button
                onClick={() => setResult(null)}
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                ✏️ Corriger une autre copie
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
