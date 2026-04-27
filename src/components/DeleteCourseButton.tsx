'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/courses/${courseId}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.preventDefault()}>
        <button
          onClick={e => { e.preventDefault(); setConfirming(false) }}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
        >
          Annuler
        </button>
        <button
          onClick={e => { e.preventDefault(); handleDelete() }}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition disabled:opacity-50"
        >
          {loading ? '...' : 'Supprimer'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); setConfirming(true) }}
      className="text-xs text-gray-400 hover:text-red-500 border rounded-lg px-2 py-1 hover:border-red-200 transition"
      title="Supprimer ce cours"
    >
      🗑️
    </button>
  )
}
