'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AssignFolderButton } from '@/components/AssignFolderButton'

interface Notion { term: string; definition: string }
interface Section { title: string; notions: Notion[]; points: string[]; retenir?: string }
interface StructuredContent {
  title: string
  plan: string[]
  sections: Section[]
  summary: string
}
interface Folder { id: string; name: string; color: string }
interface Course {
  id: string
  title: string
  rawContent: string
  structuredContent: StructuredContent
  status: string
  updatedAt: string
  folderId?: string | null
  folder?: { id: string; name: string; color: string }
}

export default function CoursePage() {
  const { id } = useParams()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [folders, setFolders] = useState<Folder[]>([])
  const [showExport, setShowExport] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function fetchCourse() {
    fetch(`/api/courses/${id}`)
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then((data: Course) => {
        setCourse(data)
        setLoading(false)
        if (data.status === 'ready' || data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchCourse()
    fetch('/api/folders').then(r => r.json()).then(data => setFolders(Array.isArray(data) ? data : []))
    pollRef.current = setInterval(fetchCourse, 5000)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [id])

  async function handleDelete() {
    if (!confirm('Supprimer ce cours ?')) return
    await fetch(`/api/courses/${id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  function formatElapsed(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${s % 60}s`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
    </div>
  )

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-gray-500">Cours introuvable</p>
    </div>
  )

  if (course.status === 'processing') return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center gap-4">
        <a href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</a>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="border rounded-2xl p-12">
          <div className="flex justify-center mb-6">
            <svg className="animate-spin h-12 w-12 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">L&apos;IA restructure ton cours</h2>
          <p className="text-gray-500 text-sm mb-1">Traitement en arrière-plan, cette page se met à jour automatiquement.</p>
          <p className="text-gray-400 text-sm mb-6">Temps écoulé : <span className="font-mono text-indigo-600">{formatElapsed(elapsed)}</span></p>
          <p className="text-indigo-600 text-xs bg-indigo-50 rounded-lg p-3">Tu peux fermer cette page — le traitement continue en arrière-plan.</p>
        </div>
      </main>
    </div>
  )

  if (course.status === 'error') return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4">
        <a href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</a>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="border rounded-2xl p-12">
          <p className="text-red-600 font-semibold mb-4">Erreur lors du traitement</p>
          <button onClick={handleDelete} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition">
            Supprimer et recommencer
          </button>
        </div>
      </main>
    </div>
  )

  const s = course.structuredContent || { title: '', plan: [], sections: [], summary: '' }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b px-6 py-3 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          {course.folder && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{course.folder.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowRaw(!showRaw)} className="text-gray-400 hover:text-gray-600 text-sm border rounded-lg px-3 py-1.5">
            {showRaw ? 'Cours structuré' : 'Cours original'}
          </button>
          {course && (
            <AssignFolderButton courseId={course.id} currentFolderId={course.folderId} folders={folders} />
          )}
          {/* Export */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)} className="text-gray-500 hover:text-gray-700 text-sm border rounded-lg px-3 py-1.5">
              ⬇️ Exporter
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-9 z-50 bg-white border rounded-xl shadow-lg py-1 min-w-[160px]">
                  <button onClick={() => { window.print(); setShowExport(false) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                    🖨️ PDF (impression)
                  </button>
                  <a href={`/api/courses/${id}/export?format=docx`} onClick={() => setShowExport(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                    📄 Word (.docx)
                  </a>
                  <a href={`/api/courses/${id}/export?format=odt`} onClick={() => setShowExport(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                    📝 LibreOffice (.odt)
                  </a>
                </div>
              </>
            )}
          </div>
          <a href={`/courses/${id}/flashcards`} className="border border-indigo-300 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-50 transition">
            🃏 Flashcards
          </a>
          <a href={`/courses/${id}/quiz`} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            🧠 Quiz
          </a>
          <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-sm px-2">Supprimer</button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* Cours original */}
        {showRaw ? (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-4">{course.title}</h1>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{course.rawContent}</pre>
          </div>
        ) : (
          <>
            {/* Titre */}
            <h1 className="text-2xl font-bold text-gray-900 mb-6">{course.title}</h1>

            {/* Résumé */}
            {s.summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Résumé</p>
                <p className="text-gray-700 text-sm leading-relaxed">{s.summary}</p>
              </div>
            )}

            {/* Plan du cours */}
            {s.plan && s.plan.length > 0 && (
              <div className="border rounded-xl p-5 mb-8">
                <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span>📋</span> Plan du Cours
                </h2>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {s.plan.map((item, i) => (
                    <li key={i} className="text-gray-700 text-sm">
                      <button
                        className="hover:text-indigo-600 text-left"
                        onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        {typeof item === 'string' ? item : (item as {text?: string}).text || ''}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Sections */}
            {s.sections && s.sections.map((section, i) => (
              <div key={i} id={`section-${i}`} className="mb-10">
                {/* Titre de section */}
                <div className="bg-slate-50 border-l-4 border-indigo-500 rounded-r-xl px-5 py-3 mb-5">
                  <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <span>📖</span> {i + 1}. {section.title}
                  </h2>
                </div>

                {/* Notions clés */}
                {section.notions && section.notions.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                      🔑 Notions clés &amp; Définitions
                    </p>
                    <ul className="space-y-3">
                      {section.notions.map((n, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed">
                          <span className="text-gray-400 mt-1">•</span>
                          <span>
                            <span className="font-semibold text-gray-900">{n.term}</span>
                            <span className="text-gray-500"> : </span>
                            <span className="text-gray-700">{n.definition}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Points essentiels */}
                {section.points && section.points.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                      📝 Points Essentiels
                    </p>
                    <ul className="space-y-3">
                      {section.points.map((point, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed">
                          <span className="text-gray-400 mt-1 shrink-0">•</span>
                          <span className="text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* À retenir */}
                {section.retenir && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">⚡ À retenir</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{section.retenir}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
