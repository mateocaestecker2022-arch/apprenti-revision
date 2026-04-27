'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Folder { id: string; name: string; color: string }

export function AssignFolderButton({ courseId, currentFolderId, folders }: {
  courseId: string
  currentFolderId?: string | null
  folders: Folder[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function assign(folderId: string | null) {
    setLoading(true)
    await fetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const current = folders.find(f => f.id === currentFolderId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 hover:border-indigo-300 hover:text-indigo-600 transition text-gray-500"
      >
        {current ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: current.color }} />
            {current.name}
          </>
        ) : '📁 Dossier'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 bg-white border rounded-xl shadow-lg py-1 min-w-[180px]">
            {folders.length === 0 && (
              <p className="text-xs text-gray-400 px-4 py-2">Aucun dossier créé</p>
            )}
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => assign(f.id)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition ${f.id === currentFolderId ? 'font-medium text-indigo-600' : 'text-gray-700'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                {f.name}
              </button>
            ))}
            {currentFolderId && (
              <>
                <div className="border-t my-1" />
                <button onClick={() => assign(null)} className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-slate-50 transition">
                  Retirer du dossier
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
