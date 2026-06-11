'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { SignalementButton } from '@/components/SignalementButton'

const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2']

type Mode = 'grand_oral' | 'consultation' | 'examen_blanc'

interface Exercise {
  mode: Mode
  modeLabel: string
  dureeMinutes: number
  consigne?: string
  avertissement: string
  // grand_oral
  sujet?: string
  thematique?: string
  axesPossibles?: string[]
  piegePossible?: string
  // consultation
  client?: string
  faits?: string
  question?: string
  enjeuxJuridiques?: string[]
  // examen_blanc
  typeExercice?: string
  consignes?: string[]
  criteresCorrectionCRFPA?: string[]
}

interface Evaluation {
  appreciationGlobale: string
  criteres: Array<{ nom: string; appréciation: string; commentaire: string }>
  pointsForts: string[]
  axesProgression: string[]
  conseilPrioritaire: string
  avertissement: string
}

const APPRECIATION_COLOR: Record<string, string> = {
  'Très bien': 'text-green-600 dark:text-green-400',
  'Bien': 'text-blue-600 dark:text-blue-400',
  'Assez bien': 'text-cyan-600 dark:text-cyan-400',
  'Passable': 'text-amber-600 dark:text-amber-400',
  'Insuffisant': 'text-red-600 dark:text-red-400',
}

const APPRECIATION_BG: Record<string, string> = {
  'Très bien': 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  'Bien': 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  'Assez bien': 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800',
  'Passable': 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  'Insuffisant': 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
}

export default function ConcoursPage() {
  const id = useParams().id as string
  const [mode, setMode] = useState<Mode>('consultation')
  const [niveau, setNiveau] = useState('L1')
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [reponse, setReponse] = useState('')
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingEval, setLoadingEval] = useState(false)
  const [error, setError] = useState('')
  const [timerActive, setTimerActive] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function startTimer(minutes: number) {
    setSecondsLeft(minutes * 60)
    setTimerActive(true)
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          setTimerActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  async function generateExercise() {
    setLoading(true)
    setError('')
    setExercise(null)
    setReponse('')
    setEvaluation(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerActive(false)
    try {
      const res = await fetch(`/api/courses/${id}/concours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', mode, niveau }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setExercise(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  async function submitEvaluation() {
    if (!exercise) return
    const sujet = exercise.sujet || exercise.question || exercise.typeExercice || ''
    setLoadingEval(true)
    setError('')
    setEvaluation(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerActive(false)
    try {
      const res = await fetch(`/api/courses/${id}/concours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', mode, sujet, reponse, niveau }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setEvaluation(json)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoadingEval(false)
  }

  const modeConfig = {
    grand_oral: { label: 'Grand oral CRFPA', emoji: '🎤', color: 'indigo', desc: "L'IA génère un sujet de grand oral. Tu prépares ton introduction et ton plan, puis tu développes." },
    consultation: { label: 'Consultation juridique', emoji: '👨‍⚖️', color: 'emerald', desc: "Un client fictif te consulte. Rédige une consultation structurée basée sur les règles de ton cours." },
    examen_blanc: { label: 'Examen blanc', emoji: '📝', color: 'rose', desc: "Sujet de dissertation ou commentaire en conditions d'examen. Timer disponible." },
  }

  const colorClass = {
    indigo: { btn: 'bg-indigo-600 hover:bg-indigo-700', border: 'border-indigo-500', tab: 'border-indigo-600 text-indigo-600 dark:text-indigo-400', badge: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
    emerald: { btn: 'bg-emerald-600 hover:bg-emerald-700', border: 'border-emerald-500', tab: 'border-emerald-600 text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
    rose: { btn: 'bg-rose-600 hover:bg-rose-700', border: 'border-rose-500', tab: 'border-rose-600 text-rose-600 dark:text-rose-400', badge: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' },
  }

  const activeColor = colorClass[modeConfig[mode].color as keyof typeof colorClass]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <a href={`/courses/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Cours</a>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🏆 Entraînement Concours</span>
        {timerActive && (
          <span className={`ml-auto text-sm font-mono font-bold px-3 py-1 rounded-lg ${secondsLeft < 300 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            ⏱ {formatTime(secondsLeft)}
          </span>
        )}
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Sélection du mode */}
        {!exercise && (
          <>
            <div className="flex gap-0 border-b dark:border-gray-800 mb-6">
              {(Object.keys(modeConfig) as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError('') }}
                  className={`pb-3 px-3 text-xs font-medium border-b-2 -mb-px transition ${mode === m ? colorClass[modeConfig[m].color as keyof typeof colorClass].tab : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {modeConfig[m].emoji} {modeConfig[m].label}
                </button>
              ))}
            </div>

            <div className="text-center mb-8">
              <p className="text-5xl mb-4">{modeConfig[mode].emoji}</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{modeConfig[mode].label}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">{modeConfig[mode].desc}</p>

              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-sm text-gray-500 dark:text-gray-400">Niveau :</span>
                <div className="flex gap-1">
                  {NIVEAUX.map(n => (
                    <button key={n} onClick={() => setNiveau(n)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${niveau === n ? `${activeColor.btn} text-white` : 'border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <button onClick={generateExercise} disabled={loading}
                className={`${activeColor.btn} text-white px-8 py-3 rounded-xl font-semibold transition disabled:opacity-50`}>
                {loading ? 'Génération du sujet...' : 'Générer le sujet'}
              </button>
            </div>
          </>
        )}

        {/* Exercice affiché */}
        {exercise && !evaluation && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeColor.badge}`}>
                {exercise.modeLabel} · {exercise.dureeMinutes} min
              </span>
              <button onClick={() => setExercise(null)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                ← Retour
              </button>
            </div>

            {/* Grand oral */}
            {mode === 'grand_oral' && (
              <div className="border dark:border-gray-700 rounded-xl overflow-hidden mb-5">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 px-5 py-4 border-b dark:border-gray-700">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Sujet de grand oral</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">{exercise.sujet}</p>
                  {exercise.thematique && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{exercise.thematique}</p>}
                </div>
                <div className="p-4 space-y-3">
                  {exercise.axesPossibles && exercise.axesPossibles.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Axes à développer</p>
                      <ul className="space-y-1">
                        {exercise.axesPossibles.map((a, i) => (
                          <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <span className="shrink-0 text-indigo-400">→</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {exercise.piegePossible && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">⚠ Piège possible</p>
                      <p className="text-sm text-amber-800 dark:text-amber-300">{exercise.piegePossible}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Consultation */}
            {mode === 'consultation' && (
              <div className="border dark:border-gray-700 rounded-xl overflow-hidden mb-5">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 border-b dark:border-gray-700">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Votre client</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{exercise.client}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Les faits</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{exercise.faits}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg p-3">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">Question juridique</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{exercise.question}</p>
                  </div>
                  {exercise.enjeuxJuridiques && exercise.enjeuxJuridiques.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Enjeux identifiés</p>
                      <ul className="space-y-1">
                        {exercise.enjeuxJuridiques.map((e, i) => (
                          <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <span className="shrink-0 text-emerald-500">•</span>{e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Examen blanc */}
            {mode === 'examen_blanc' && (
              <div className="border dark:border-gray-700 rounded-xl overflow-hidden mb-5">
                <div className="bg-rose-50 dark:bg-rose-900/20 px-5 py-4 border-b dark:border-gray-700">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-1">
                    {exercise.typeExercice === 'dissertation' ? 'Dissertation' : 'Commentaire'} — Examen blanc
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">{exercise.sujet}</p>
                </div>
                <div className="p-4 space-y-3">
                  {exercise.consignes && (
                    <ul className="space-y-1">
                      {exercise.consignes.map((c, i) => (
                        <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                          <span className="shrink-0">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {exercise.criteresCorrectionCRFPA && (
                    <details>
                      <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        Critères de correction CRFPA
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {exercise.criteresCorrectionCRFPA.map((c, i) => (
                          <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                            <span className="shrink-0 text-rose-400">✓</span>{c}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Consigne + Timer */}
            {exercise.consigne && (
              <div className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-800 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">{exercise.consigne}</p>
              </div>
            )}

            {!timerActive && secondsLeft === 0 && (
              <button onClick={() => startTimer(exercise.dureeMinutes)}
                className="w-full border dark:border-gray-700 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition mb-4">
                ⏱ Démarrer le minuteur ({exercise.dureeMinutes} min)
              </button>
            )}

            {/* Rédaction */}
            <textarea
              value={reponse}
              onChange={e => setReponse(e.target.value)}
              rows={14}
              placeholder="Rédige ta réponse ici..."
              className={`w-full border dark:border-gray-700 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 resize-none focus:outline-none focus:ring-2 ${activeColor.border} mb-2`}
            />
            <p className="text-xs text-gray-400 mb-4 text-right">{reponse.length} caractères</p>

            {exercise.avertissement && (
              <p className="text-xs text-gray-400 mb-4">{exercise.avertissement}</p>
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button onClick={submitEvaluation} disabled={loadingEval || reponse.trim().length < 50}
              className={`w-full ${activeColor.btn} text-white py-3 rounded-xl font-semibold transition disabled:opacity-50`}>
              {loadingEval ? 'Évaluation CRFPA en cours...' : 'Soumettre pour évaluation'}
            </button>
          </div>
        )}

        {/* Évaluation */}
        {evaluation && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-gray-900 dark:text-white">Évaluation CRFPA</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${APPRECIATION_BG[evaluation.appreciationGlobale] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {evaluation.appreciationGlobale}
              </span>
            </div>

            <div className="space-y-2 mb-5">
              {evaluation.criteres?.map((c, i) => (
                <div key={i} className="border dark:border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.nom}</p>
                    <span className={`text-xs font-bold ${APPRECIATION_COLOR[c.appréciation] || 'text-gray-500'}`}>
                      {c.appréciation}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{c.commentaire}</p>
                </div>
              ))}
            </div>

            {evaluation.pointsForts?.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">Points forts</p>
                <ul className="space-y-1">
                  {evaluation.pointsForts.map((p, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="shrink-0">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.axesProgression?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Axes de progression</p>
                <ul className="space-y-1">
                  {evaluation.axesProgression.map((a, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <span className="shrink-0">→</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.conseilPrioritaire && (
              <div className="border-l-4 border-indigo-400 pl-4 py-1 mb-4">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Conseil prioritaire</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{evaluation.conseilPrioritaire}</p>
              </div>
            )}

            {evaluation.avertissement && (
              <p className="text-xs text-gray-400 mb-5">{evaluation.avertissement}</p>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t dark:border-gray-800">
              <SignalementButton
                type="correction"
                refId={`${id}-concours-${mode}`}
                contenuIA={evaluation.criteres?.map(c => `${c.nom}: ${c.commentaire}`).join('\n') || ''}
                niveau={niveau}
              />
              <div className="flex gap-2">
                <button onClick={() => { setEvaluation(null); setReponse('') }}
                  className="border dark:border-gray-700 px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Retravailler
                </button>
                <button onClick={() => { setExercise(null); setEvaluation(null); setReponse('') }}
                  className={`${activeColor.btn} text-white px-4 py-2 rounded-xl text-sm font-semibold transition`}>
                  Nouveau sujet
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
