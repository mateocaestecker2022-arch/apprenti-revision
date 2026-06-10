'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2']
const ETAPES = ['', 'Faits pertinents', 'Problème de droit', 'Règle applicable', 'Application', 'Conclusion']

interface Message { role: 'assistant' | 'user'; content: string }

type Mode = 'cas_pratique' | 'copie_td'

export default function ExerciceGuidePage() {
  const id = useParams().id as string
  const [mode, setMode] = useState<Mode>('cas_pratique')
  const [niveau, setNiveau] = useState('L1')
  const [exerciceId, setExerciceId] = useState<string | null>(null)
  const [enonce, setEnonce] = useState('')
  const [copie, setCopie] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [etapeActuelle, setEtapeActuelle] = useState(0)
  const [reponse, setReponse] = useState('')
  const [termine, setTermine] = useState(false)
  const [recapitulatif, setRecapitulatif] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avertissement, setAvertissement] = useState('')

  async function startExercice() {
    setLoading(true)
    setError('')
    try {
      const body = mode === 'copie_td'
        ? { mode: 'copie_td', copie, niveau }
        : { niveau }
      const res = await fetch(`/api/courses/${id}/exercice-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setExerciceId(json.id)
      setAvertissement(json.avertissement)
      if (mode === 'copie_td') {
        setMessages([{ role: 'assistant', content: json.questionInitiale }])
      } else {
        setEnonce(json.enonce)
        setMessages([{ role: 'assistant', content: json.enonce + '\n\n' + json.questionInitiale }])
        setEtapeActuelle(1)
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  async function sendStep() {
    if (!reponse.trim() || !exerciceId) return
    const userMsg = reponse.trim()
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setReponse('')
    setLoading(true)
    try {
      const res = await fetch(`/api/exercice-guide/${exerciceId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reponse: userMsg }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')

      const assistantContent = json.feedback + (json.questionSuivante ? '\n\n' + json.questionSuivante : '')
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }])
      if (mode === 'cas_pratique') setEtapeActuelle(json.etapeActuelle)

      if (json.termine) {
        setTermine(true)
        setRecapitulatif(json.recapitulatif)
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  function reset() {
    setExerciceId(null); setEnonce(''); setMessages([])
    setEtapeActuelle(0); setTermine(false); setRecapitulatif(null)
    setError(''); setAvertissement('')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {mode === 'copie_td' ? 'Mode Chargé de TD' : 'Exercice guidé — Cas pratique'}
        </span>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {!exerciceId ? (
          <div className="py-8">
            {/* Sélecteur de mode */}
            <div className="flex gap-2 mb-8 border-b dark:border-gray-800">
              <button
                onClick={() => { setMode('cas_pratique'); setError('') }}
                className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition ${mode === 'cas_pratique' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                ⚖️ Cas pratique
              </button>
              <button
                onClick={() => { setMode('copie_td'); setError('') }}
                className={`pb-3 px-4 text-sm font-medium border-b-2 -mb-px transition ${mode === 'copie_td' ? 'border-teal-600 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                📝 Chargé de TD
              </button>
            </div>

            {mode === 'cas_pratique' ? (
              <div className="text-center">
                <p className="text-5xl mb-4">⚖️</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Exercice guidé pas à pas</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                  L&apos;IA génère un cas pratique inventé à partir de ton cours et te guide étape par étape selon le syllogisme juridique.
                </p>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Niveau :</span>
                  <div className="flex gap-1">
                    {NIVEAUX.map(n => (
                      <button key={n} onClick={() => setNiveau(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${niveau === n ? 'bg-indigo-600 text-white' : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <button onClick={startExercice} disabled={loading}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                  {loading ? 'Génération du cas...' : 'Commencer l\'exercice'}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-5xl text-center mb-4">📝</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Mode Chargé de TD</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md mx-auto">
                  Dépose ta copie. L&apos;IA la lit et te questionne de façon socratique pour t&apos;aider à l&apos;améliorer toi-même.
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Niveau :</span>
                  <div className="flex gap-1">
                    {NIVEAUX.map(n => (
                      <button key={n} onClick={() => setNiveau(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${niveau === n ? 'bg-teal-600 text-white' : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={copie}
                  onChange={e => setCopie(e.target.value)}
                  maxLength={8000}
                  rows={10}
                  placeholder="Colle ta copie ici (minimum 50 caractères)..."
                  className="w-full border dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
                />
                <p className="text-xs text-gray-400 mb-4 text-right">{copie.length}/8000</p>
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <button onClick={startExercice} disabled={loading || copie.trim().length < 50}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition disabled:opacity-50">
                  {loading ? 'Analyse de la copie...' : 'Soumettre ma copie'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Avertissement */}
            {avertissement && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                <span className="text-amber-500 shrink-0">⚠️</span>
                <p className="text-xs text-amber-700 dark:text-amber-400">{avertissement}</p>
              </div>
            )}

            {/* Progress — uniquement pour le cas pratique */}
            {mode === 'cas_pratique' && (
              <>
                <div className="flex items-center gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex-1">
                      <div className={`h-2 rounded-full transition-colors ${i <= etapeActuelle ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'}`} />
                      <p className="text-[10px] text-gray-400 mt-1 text-center hidden sm:block">{ETAPES[i]}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-6">
                  Étape {Math.min(etapeActuelle, 5)}/5 — {ETAPES[Math.min(etapeActuelle, 5)] || 'Terminé'}
                </p>
              </>
            )}

            {/* Badge mode TD */}
            {mode === 'copie_td' && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 py-1 rounded-full font-semibold">📝 Chargé de TD actif</span>
                <span className="text-xs text-gray-400">L&apos;IA questionne ta copie sans jamais donner les réponses.</span>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-4 mb-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? `${mode === 'copie_td' ? 'bg-teal-600' : 'bg-indigo-600'} text-white rounded-br-sm`
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Récapitulatif final */}
            {termine && recapitulatif && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-5 mb-6">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">
                  {mode === 'copie_td' ? 'Bilan de la session TD' : 'Récapitulatif'}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{recapitulatif}</p>
              </div>
            )}

            {/* Input */}
            {!termine ? (
              <div className="flex gap-2">
                <textarea
                  value={reponse}
                  onChange={e => setReponse(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !loading) { e.preventDefault(); sendStep() } }}
                  disabled={loading}
                  rows={3}
                  placeholder="Ta réponse... (Entrée pour envoyer)"
                  className={`flex-1 border dark:border-gray-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 ${mode === 'copie_td' ? 'focus:ring-teal-500' : 'focus:ring-indigo-500'}`}
                />
                <button
                  onClick={sendStep}
                  disabled={loading || !reponse.trim()}
                  className={`${mode === 'copie_td' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 rounded-xl transition disabled:opacity-50 shrink-0`}
                >
                  →
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
                <SignalementButton
                  type="exercice_guide"
                  refId={exerciceId}
                  contenuIA={messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n').slice(0, 3000)}
                  niveau={niveau}
                />
                <button onClick={reset}
                  className={`${mode === 'copie_td' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-5 py-2 rounded-xl text-sm font-semibold transition`}>
                  {mode === 'copie_td' ? 'Nouvelle copie' : 'Nouvel exercice'}
                </button>
              </div>
            )}

            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </>
        )}
      </main>
    </div>
  )
}
