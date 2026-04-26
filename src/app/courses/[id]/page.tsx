'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Keyword { term: string; definition: string }
interface PlanItem { level: number; text: string }
interface Section { title: string; level: number; content: string }
interface StructuredContent {
  title: string
  plan: PlanItem[]
  keywords: Keyword[]
  sections: Section[]
  summary: string
}
interface Course {
  id: string
  title: string
  rawContent: string
  structuredContent: StructuredContent
  keywords: Keyword[]
  status: string
  updatedAt: string
  folder?: { name: string; color: string }
}

export default function CoursePage() {
  const { id } = useParams()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'structured' | 'raw'>('structured')
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function fetchCourse() {
    fetch(`/api/courses/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
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
    // Poll toutes les 5 secondes
    pollRef.current = setInterval(fetchCourse, 5000)
    // Timer affiché pendant le processing
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-500">Cours introuvable</p>
      </div>
    )
  }

  // Écran de traitement en cours
  if (course.status === 'processing') {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <a href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</a>
          <h1 className="text-lg font-bold text-indigo-600">Traitement en cours</h1>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="bg-white rounded-2xl border shadow-sm p-12">
            <div className="flex justify-center mb-6">
              <svg className="animate-spin h-14 w-14 text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">L&apos;IA restructure ton cours</h2>
            <p className="text-gray-500 mb-2">
              Le traitement est en arrière-plan. Cette page se met à jour automatiquement.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Temps écoulé : <span className="font-mono text-indigo-600">{formatElapsed(elapsed)}</span>
            </p>
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
              Tu peux fermer cette page et revenir plus tard — le traitement continue en arrière-plan.
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Écran d'erreur
  if (course.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <a href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</a>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="bg-white rounded-2xl border shadow-sm p-12">
            <p className="text-red-600 text-lg font-semibold mb-4">Erreur lors du traitement</p>
            <p className="text-gray-500 mb-6">Une erreur s&apos;est produite. Essaie de supprimer ce cours et de le recréer.</p>
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition"
            >
              Supprimer et recommencer
            </button>
          </div>
        </main>
      </div>
    )
  }

  const structured = course.structuredContent || { title: '', plan: [], keywords: [], sections: [], summary: '' }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          {course.folder && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              {course.folder.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/courses/${id}/quiz`}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
          >
            Générer un quiz
          </a>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Supprimer
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
        <p className="text-gray-400 text-sm mb-6">
          Mis à jour le {new Date(course.updatedAt).toLocaleDateString('fr-FR')}
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('structured')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'structured'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border hover:bg-slate-50'
            }`}
          >
            Cours structuré
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border hover:bg-slate-50'
            }`}
          >
            Cours original
          </button>
        </div>

        {activeTab === 'raw' ? (
          <div className="bg-white rounded-2xl border p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{course.rawContent}</pre>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Résumé */}
            {structured.summary && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide mb-2">Résumé</h2>
                <p className="text-gray-700">{structured.summary}</p>
              </div>
            )}

            {/* Plan */}
            {structured.plan && structured.plan.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Plan du cours</h2>
                <ul className="space-y-1">
                  {structured.plan.map((item, i) => (
                    <li
                      key={i}
                      className={`text-gray-700 ${
                        item.level === 1
                          ? 'font-bold text-red-600 text-base'
                          : item.level === 2
                          ? 'font-semibold text-gray-800 ml-4'
                          : 'text-gray-600 ml-8 text-sm'
                      }`}
                    >
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mots-clés */}
            {structured.keywords && structured.keywords.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Mots-clés et définitions</h2>
                <div className="space-y-3">
                  {structured.keywords.map((kw, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="font-semibold text-indigo-700 min-w-[150px]">{kw.term}</span>
                      <span className="text-gray-600 text-sm">{kw.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sections */}
            {structured.sections && structured.sections.map((section, i) => (
              <div key={i} className="bg-white rounded-2xl border p-6">
                <h2
                  className={`font-bold mb-4 ${
                    section.level === 1
                      ? 'text-xl text-red-600'
                      : section.level === 2
                      ? 'text-lg text-gray-800'
                      : 'text-base text-gray-700'
                  }`}
                >
                  {section.title}
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
