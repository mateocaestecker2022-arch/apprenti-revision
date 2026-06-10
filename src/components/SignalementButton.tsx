'use client'

import { useState } from 'react'

interface Props {
  type: 'correction' | 'methodo' | 'exercice_guide'
  refId: string
  contenuIA: string
  niveau?: string
}

export function SignalementButton({ type, refId, contenuIA, niveau }: Props) {
  const [open, setOpen] = useState(false)
  const [probleme, setProbleme] = useState('erreur_juridique')
  const [commentaire, setCommentaire] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    await fetch('/api/signalements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, refId, contenuIA, probleme, commentaire, niveau }),
    })
    setSent(true)
    setLoading(false)
    setTimeout(() => { setOpen(false); setSent(false) }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1"
      >
        ⚠️ Signaler une erreur
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
            {sent ? (
              <p className="text-center text-green-600 font-semibold py-4">Signalement envoyé, merci !</p>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Signaler une erreur IA</h3>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Type de problème</label>
                <select
                  value={probleme}
                  onChange={e => setProbleme(e.target.value)}
                  className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="erreur_juridique">Erreur juridique</option>
                  <option value="article_invente">Article inventé</option>
                  <option value="methode_fausse">Méthode fausse</option>
                  <option value="autre">Autre</option>
                </select>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Commentaire (optionnel)</label>
                <textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  placeholder="Décris le problème..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setOpen(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">Annuler</button>
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {loading ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
