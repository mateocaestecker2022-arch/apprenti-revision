'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Dependance { notion: string; prerequis: string[] }

interface StructurePeda {
  notions: string[]
  dependances: Dependance[]
  ordrePedagogique: string[]
  explication: string
}

export default function StructurePage() {
  const id = useParams().id as string
  const [structure, setStructure] = useState<StructurePeda | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/courses/${id}/structure`)
      .then(r => r.json())
      .then(data => {
        if (data && data.notions) setStructure(data)
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [id])

  async function compute() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${id}/structure`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setStructure(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Structure pédagogique</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {!structure ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">🧩</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ordre pédagogique des notions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 max-w-md mx-auto">
              L&apos;IA détecte les notions, leurs dépendances et recalcule l&apos;ordre optimal pour apprendre.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl px-4 py-3 mb-8 max-w-md mx-auto">
              L&apos;IA réorganise ce qui est dans le cours — elle ne crée pas de nouvelles connaissances.
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button onClick={compute} disabled={loading}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Analyse en cours...' : 'Calculer la structure'}
            </button>
          </div>
        ) : (
          <>
            {/* Explication */}
            <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-2">💡 Logique pédagogique</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">{structure.explication}</p>
            </div>

            {/* Ordre pédagogique */}
            <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-4">📚 Ordre d&apos;apprentissage recommandé</h2>
              <div className="space-y-2">
                {structure.ordrePedagogique.map((notion, i) => {
                  const dep = structure.dependances.find(d => d.notion === notion)
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{notion}</p>
                        {dep && dep.prerequis.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Prérequis : {dep.prerequis.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Graphe des dépendances */}
            {structure.dependances.filter(d => d.prerequis.length > 0).length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-4">🔗 Dépendances entre notions</h2>
                <div className="space-y-2">
                  {structure.dependances.filter(d => d.prerequis.length > 0).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                      <div className="flex gap-1 flex-wrap">
                        {d.prerequis.map((p, j) => (
                          <span key={j} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-lg text-xs">{p}</span>
                        ))}
                      </div>
                      <span className="text-gray-400">→</span>
                      <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-xs font-semibold">{d.notion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Toutes les notions */}
            <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3">📋 Toutes les notions détectées</h2>
              <div className="flex flex-wrap gap-2">
                {structure.notions.map((n, i) => (
                  <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full">
                    {n}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t dark:border-gray-800">
              <button onClick={compute} disabled={loading}
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 disabled:opacity-50">
                {loading ? 'Recalcul...' : '🔄 Recalculer'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
