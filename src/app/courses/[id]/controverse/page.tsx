'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

type Tab = 'controverses' | 'comparative'

interface Controverse {
  sujet: string
  positionA: string
  positionB: string
  enjeu: string
  source_dans_le_cours: string
}

interface ControversesResult {
  controverses: Controverse[]
  synthese: string
  avertissement: string
}

interface Axe {
  axe: string
  elementA: { nom: string; contenu: string }
  elementB: { nom: string; contenu: string }
}

interface ComparativeResult {
  titre: string
  axes: Axe[]
  synthese: string
  limite?: string
  avertissement: string
}

export default function ControversePage() {
  const id = useParams().id as string
  const [tab, setTab] = useState<Tab>('controverses')
  const [concept, setConcept] = useState('')
  const [resultControverses, setResultControverses] = useState<ControversesResult | null>(null)
  const [resultComparative, setResultComparative] = useState<ComparativeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runAction(action: Tab) {
    setLoading(true)
    setError('')
    if (action === 'controverses') setResultControverses(null)
    else setResultComparative(null)

    try {
      const res = await fetch(`/api/courses/${id}/controverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, concept: concept.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      if (action === 'controverses') setResultControverses(json)
      else setResultComparative(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const result = tab === 'controverses' ? resultControverses : resultComparative

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">⚡ Controverses & Comparatif</span>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Tabs */}
        <div className="flex gap-0 border-b dark:border-gray-800 mb-6">
          <button onClick={() => { setTab('controverses'); setError('') }}
            className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition ${tab === 'controverses' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            ⚡ Controverses doctrinales
          </button>
          <button onClick={() => { setTab('comparative'); setError('') }}
            className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition ${tab === 'comparative' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            📊 Analyse comparative
          </button>
        </div>

        {/* Description */}
        {!result && (
          <div className="mb-8">
            {tab === 'controverses' ? (
              <>
                <p className="text-5xl text-center mb-4">⚡</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Controverses doctrinales</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md mx-auto">
                  Détecte les débats et tensions doctrinales <strong>explicitement présents</strong> dans ton cours.
                  Aucune position externe n&apos;est ajoutée.
                </p>
              </>
            ) : (
              <>
                <p className="text-5xl text-center mb-4">📊</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Analyse comparative</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md mx-auto">
                  Compare des notions, régimes ou mécanismes présents dans le cours sous forme de tableau structuré.
                  Idéal pour préparer une dissertation ou un commentaire.
                </p>
              </>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {tab === 'controverses'
                  ? 'Notion à cibler (optionnel) :'
                  : 'Notions à comparer (ex: "propriété et possession") :'}
              </label>
              <input
                type="text"
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder={tab === 'controverses' ? 'Ex: responsabilité délictuelle, possession...' : 'Ex: contrat et quasi-contrat, vente et bail...'}
                className="w-full border dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button onClick={() => runAction(tab)} disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50 ${tab === 'controverses' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
              {loading
                ? (tab === 'controverses' ? 'Analyse des tensions...' : 'Analyse comparative...')
                : (tab === 'controverses' ? 'Détecter les controverses' : 'Lancer la comparaison')}
            </button>
          </div>
        )}

        {/* Résultat Controverses */}
        {tab === 'controverses' && resultControverses && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {resultControverses.controverses.length === 0
                  ? 'Aucune controverse détectée'
                  : `${resultControverses.controverses.length} controverse${resultControverses.controverses.length > 1 ? 's' : ''} détectée${resultControverses.controverses.length > 1 ? 's' : ''}`}
              </h2>
              <button onClick={() => setResultControverses(null)}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ← Retour
              </button>
            </div>

            {resultControverses.controverses.length === 0 ? (
              <div className="border dark:border-gray-700 rounded-xl p-6 text-center mb-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm">{resultControverses.synthese}</p>
              </div>
            ) : (
              <div className="space-y-4 mb-5">
                {resultControverses.controverses.map((c, i) => (
                  <div key={i} className="border dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-3 border-b dark:border-gray-700">
                      <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm">{c.sujet}</p>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Position A</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{c.positionA}</p>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-lg p-3">
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">Position B</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{c.positionB}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-3 space-y-2">
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Enjeu</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{c.enjeu}</p>
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          Source dans le cours
                        </summary>
                        <p className="mt-1 text-gray-500 dark:text-gray-400 italic border-l-2 border-orange-200 dark:border-orange-800 pl-3 py-1">
                          {c.source_dans_le_cours}
                        </p>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultControverses.synthese && resultControverses.controverses.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Synthèse</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{resultControverses.synthese}</p>
              </div>
            )}

            {resultControverses.avertissement && (
              <p className="text-xs text-gray-400 mb-4">{resultControverses.avertissement}</p>
            )}

            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="analyse"
                refId={`${id}-controverse`}
                contenuIA={resultControverses.controverses.map(c => c.sujet).join(', ')}
              />
              <button onClick={() => runAction('controverses')} disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                {loading ? '...' : 'Relancer'}
              </button>
            </div>
          </div>
        )}

        {/* Résultat Comparative */}
        {tab === 'comparative' && resultComparative && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 dark:text-white">{resultComparative.titre}</h2>
              <button onClick={() => setResultComparative(null)}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ← Retour
              </button>
            </div>

            <div className="overflow-x-auto mb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="border dark:border-gray-700 px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-1/4">Critère</th>
                    <th className="border dark:border-gray-700 px-3 py-2 text-left text-xs font-bold text-blue-600 dark:text-blue-400">
                      {resultComparative.axes[0]?.elementA?.nom || 'Élément A'}
                    </th>
                    <th className="border dark:border-gray-700 px-3 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400">
                      {resultComparative.axes[0]?.elementB?.nom || 'Élément B'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultComparative.axes.map((axe, i) => (
                    <tr key={i} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="border dark:border-gray-700 px-3 py-2 font-medium text-gray-700 dark:text-gray-300 text-xs">{axe.axe}</td>
                      <td className="border dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-400">{axe.elementA.contenu}</td>
                      <td className="border dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-400">{axe.elementB.contenu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 rounded-xl p-4 mb-3">
              <p className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide mb-1">Synthèse</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{resultComparative.synthese}</p>
            </div>

            {resultComparative.limite && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-bold">⚠ Limite :</span> {resultComparative.limite}
                </p>
              </div>
            )}

            {resultComparative.avertissement && (
              <p className="text-xs text-gray-400 mb-4">{resultComparative.avertissement}</p>
            )}

            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="analyse"
                refId={`${id}-comparative`}
                contenuIA={resultComparative.titre}
              />
              <button onClick={() => runAction('comparative')} disabled={loading}
                className="bg-cyan-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-cyan-700 transition disabled:opacity-50">
                {loading ? '...' : 'Relancer'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
