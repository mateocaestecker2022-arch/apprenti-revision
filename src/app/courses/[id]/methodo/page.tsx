'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

type TypeMethodo = 'cas_pratique' | 'commentaire_arret' | 'dissertation'

const TYPES: { value: TypeMethodo; label: string; icon: string }[] = [
  { value: 'cas_pratique', label: 'Cas pratique', icon: '⚖️' },
  { value: 'commentaire_arret', label: "Commentaire d'arrêt", icon: '📋' },
  { value: 'dissertation', label: 'Dissertation', icon: '✍️' },
]

interface Etape { numero: number; titre: string; objectif: string; conseils: string; erreurFrequente: string }
interface TermeVocab { terme: string; definition: string }
interface MethtodoData {
  id?: string
  type: string
  typeLabel: string
  etapes: Etape[]
  planType: string[]
  vocabulaireCle: TermeVocab[]
  piegesAEviter: string[]
  avertissement: string
}

const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2']

export default function MethodoPage() {
  const { id } = useParams()
  const [activeType, setActiveType] = useState<TypeMethodo>('cas_pratique')
  const [niveau, setNiveau] = useState('L1')
  const [data, setData] = useState<Record<string, MethtodoData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/courses/${id}/methodo`)
      .then(r => r.json())
      .then((methodos: Array<{ type: string; content: MethtodoData; id: string }>) => {
        if (Array.isArray(methodos)) {
          const map: Record<string, MethtodoData> = {}
          for (const m of methodos) {
            if (!map[m.type]) map[m.type] = { ...m.content, id: m.id }
          }
          setData(map)
        }
      })
  }, [id])

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${id}/methodo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, niveau }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setData(prev => ({ ...prev, [activeType]: json }))
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const current = data[activeType]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Méthodologie juridique</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Sélecteur niveau */}
        <div className="flex items-center gap-3 mb-6">
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

        {/* Onglets types */}
        <div className="flex gap-2 mb-6 border-b dark:border-gray-800">
          {TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={`pb-3 px-3 text-sm font-medium transition border-b-2 -mb-px ${activeType === t.value ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {!current ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">{TYPES.find(t => t.value === activeType)?.icon}</p>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Aucune fiche générée pour &quot;{TYPES.find(t => t.value === activeType)?.label}&quot;.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Génération...' : 'Générer la fiche'}
            </button>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        ) : (
          <div>
            {/* Avertissement */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 mb-6 flex items-start gap-2">
              <span className="text-amber-500 shrink-0">⚠️</span>
              <p className="text-xs text-amber-700 dark:text-amber-400">{current.avertissement}</p>
            </div>

            {/* Étapes */}
            <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Étapes de la méthode</h2>
            <div className="space-y-4 mb-8">
              {current.etapes.map(e => (
                <div key={e.numero} className="border dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{e.numero}</span>
                    <h3 className="font-bold text-gray-900 dark:text-white">{e.titre}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>Objectif :</strong> {e.objectif}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>Conseils :</strong> {e.conseils}</p>
                  {e.erreurFrequente && (
                    <p className="text-sm text-red-600 dark:text-red-400">⚠️ Erreur fréquente : {e.erreurFrequente}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Plan type */}
            {current.planType?.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3">📋 Plan type</h2>
                <ul className="space-y-1">
                  {current.planType.map((p, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vocabulaire */}
            {current.vocabulaireCle?.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3">🔑 Vocabulaire clé</h2>
                <ul className="space-y-2">
                  {current.vocabulaireCle.map((v, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-semibold text-gray-900 dark:text-white">{v.terme}</span>
                      <span className="text-gray-500"> : </span>
                      <span className="text-gray-700 dark:text-gray-300">{v.definition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pièges */}
            {current.piegesAEviter?.length > 0 && (
              <div className="border border-red-100 dark:border-red-900/30 rounded-xl p-5 mb-6">
                <h2 className="font-bold text-red-600 mb-3">🚫 Pièges à éviter</h2>
                <ul className="space-y-1">
                  {current.piegesAEviter.map((p, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="methodo"
                refId={current.id || activeType}
                contenuIA={JSON.stringify(current).slice(0, 3000)}
                niveau={niveau}
              />
              <button
                onClick={generate}
                disabled={loading}
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 disabled:opacity-50"
              >
                {loading ? 'Régénération...' : '🔄 Regénérer'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
