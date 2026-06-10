'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

interface Notion {
  concept: string
  etat: 'defini' | 'mentionne_mais_non_defini' | 'cite_sans_explication'
  occurrences: number
  extrait?: string
}

interface Trou {
  type: 'notion_sans_definition' | 'article_sans_explication' | 'jurisprudence_sans_apport'
  reference: string
  contexte: string
}

interface AnalyseResult {
  notions: Notion[]
  trous: Trou[]
  forces: string[]
  synthese: string
  niveauCouverture: 'complet' | 'partiel' | 'introductif'
}

const ETAT_CONFIG = {
  defini: { label: '✓ Défini', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  mentionne_mais_non_defini: { label: '⚠ Mentionné, non défini', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  cite_sans_explication: { label: '⚠ Cité sans explication', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
}

const TROU_TYPE_LABEL = {
  notion_sans_definition: 'Notion non définie',
  article_sans_explication: 'Article sans explication',
  jurisprudence_sans_apport: 'Jurisprudence sans apport',
}

const COUVERTURE_CONFIG = {
  complet: { label: 'Couverture complète', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' },
  partiel: { label: 'Couverture partielle', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30' },
  introductif: { label: 'Niveau introductif', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30' },
}

export default function AnalysePage() {
  const id = useParams().id as string
  const [result, setResult] = useState<AnalyseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function launch() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${id}/analyse`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setResult(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const couverture = result ? COUVERTURE_CONFIG[result.niveauCouverture] ?? COUVERTURE_CONFIG.partiel : null
  const notionsAvecTrous = result ? result.notions.filter(n => n.etat !== 'defini').length : 0

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Analyse de couverture</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {!result ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">🔬</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Analyse de couverture du cours</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 max-w-md mx-auto">
              Détecte les notions bien définies, celles qui sont seulement mentionnées, et les trous documentaires.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3 mb-8 max-w-md mx-auto">
              ⚠️ Ce constat est purement documentaire — l&apos;IA mesure ce qui est présent ou absent dans ton cours. Elle n&apos;invente rien et ne comble aucun trou.
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={launch}
              disabled={loading}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Analyse en cours...' : 'Lancer l\'analyse'}
            </button>
          </div>
        ) : (
          <>
            {/* Niveau de couverture */}
            <div className={`border rounded-xl p-5 mb-6 ${couverture?.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Niveau de couverture</p>
                  <p className={`text-xl font-bold ${couverture?.color}`}>{couverture?.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notions à approfondir</p>
                  <p className={`text-3xl font-extrabold ${notionsAvecTrous > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>{notionsAvecTrous}</p>
                </div>
              </div>
            </div>

            {/* Synthèse */}
            <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-2">📊 Synthèse</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">{result.synthese}</p>
            </div>

            {/* Forces */}
            {result.forces.length > 0 && (
              <div className="border border-green-100 dark:border-green-900/30 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-green-700 dark:text-green-400 mb-3">✅ Points forts du cours</h2>
                <ul className="space-y-1">
                  {result.forces.map((f, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trous détectés */}
            {result.trous.length > 0 && (
              <div className="border border-amber-100 dark:border-amber-900/30 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-amber-700 dark:text-amber-400 mb-1">⚠️ Trous documentaires détectés</h2>
                <p className="text-xs text-gray-400 mb-3">Ces éléments apparaissent dans ton cours mais sont insuffisamment développés. Vérifie avec ton chargé de TD.</p>
                <div className="space-y-3">
                  {result.trous.map((t, i) => (
                    <div key={i} className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                          {TROU_TYPE_LABEL[t.type]}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.reference}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">&quot;{t.contexte}&quot;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carte des notions */}
            <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3">🗺️ Carte des notions</h2>
              <div className="space-y-2">
                {result.notions.map((n, i) => {
                  const cfg = ETAT_CONFIG[n.etat] ?? ETAT_CONFIG.mentionne_mais_non_defini
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{n.concept}</span>
                        {n.extrait && (
                          <p className="text-xs text-gray-400 mt-0.5 italic truncate">&quot;{n.extrait}&quot;</p>
                        )}
                      </div>
                      <span className="ml-auto shrink-0 text-xs text-gray-400">{n.occurrences}×</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="analyse"
                refId={id}
                contenuIA={JSON.stringify(result).slice(0, 3000)}
              />
              <button
                onClick={() => { setResult(null); setError('') }}
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                🔄 Relancer l&apos;analyse
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
