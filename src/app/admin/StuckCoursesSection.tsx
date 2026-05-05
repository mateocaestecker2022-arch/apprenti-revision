'use client'

import { useState } from 'react'

interface StuckCourse {
  id: string
  title: string
  updatedAt: string
  subject: string
  user: { name: string | null; email: string | null }
}

export function StuckCoursesSection({ initial }: { initial: StuckCourse[] }) {
  const [courses, setCourses] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null) // courseId ou 'all'
  const [message, setMessage] = useState('')

  function minutesAgo(date: string) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (diff < 60) return `${diff} min`
    return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? diff % 60 + 'min' : ''}`
  }

  async function unblock(courseId?: string) {
    setLoading(courseId ?? 'all')
    setMessage('')
    const res = await fetch('/api/admin/stuck-courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseId ? { courseId } : {}),
    })
    const data = await res.json()
    if (res.ok) {
      setCourses(prev => courseId ? prev.filter(c => c.id !== courseId) : [])
      setMessage(`${data.unblocked} cours débloqué${data.unblocked > 1 ? 's' : ''} ✓`)
    }
    setLoading(null)
  }

  return (
    <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900 dark:text-white">⏳ Cours bloqués en traitement</span>
          {courses.length > 0 && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {courses.length}
            </span>
          )}
        </div>
        {courses.length > 1 && (
          <button
            onClick={() => unblock()}
            disabled={loading === 'all'}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {loading === 'all' ? 'En cours...' : 'Tout débloquer'}
          </button>
        )}
      </div>

      {message && (
        <div className="px-5 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm border-b dark:border-gray-800">
          {message}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400 dark:text-gray-600 text-sm">
          Aucun cours bloqué ✓
        </div>
      ) : (
        <div className="divide-y dark:divide-gray-800">
          {courses.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {c.user.name || c.user.email} · {c.subject} · bloqué depuis {minutesAgo(c.updatedAt)}
                </p>
              </div>
              <button
                onClick={() => unblock(c.id)}
                disabled={loading === c.id}
                className="shrink-0 text-xs border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {loading === c.id ? '...' : 'Débloquer'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
