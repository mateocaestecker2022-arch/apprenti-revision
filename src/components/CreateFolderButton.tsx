'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6']

export function CreateFolderButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    setLoading(false)
    setOpen(false)
    setName('')
    setColor('#6366f1')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 border rounded-xl px-3 py-2 hover:border-indigo-300 hover:text-indigo-600 transition"
      >
        + Nouveau dossier
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-4">Nouveau dossier</h3>
            <input
              autoFocus
              type="text"
              placeholder="Nom du dossier..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-500 mb-2">Couleur</p>
            <div className="flex gap-2 mb-5">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 border rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {loading ? '...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
