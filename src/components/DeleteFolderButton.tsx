'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteFolderButton({ folderId }: { folderId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setConfirming(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 border rounded-lg">
          Annuler
        </button>
        <button onClick={handleDelete} disabled={loading} className="text-sm text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50">
          {loading ? '...' : 'Supprimer le dossier'}
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-sm text-gray-400 hover:text-red-500 border rounded-lg px-3 py-1.5 hover:border-red-200 transition">
      🗑️ Supprimer le dossier
    </button>
  )
}
