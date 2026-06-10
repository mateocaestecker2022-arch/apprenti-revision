'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AssignFolderButton } from '@/components/AssignFolderButton'

interface Notion { term: string; definition: string }
interface Section { title: string; notions: Notion[]; points: string[]; retenir?: string }
interface ProblemeJuridique { question: string; principe: string; exception?: string }
interface ArticleEssentiel { article: string; description: string }
interface ErreurFrequente { erreur: string; correction: string }
interface SchemaBranch { label: string; children: string[] }
interface Schema { root: string; branches: SchemaBranch[] }
interface Jurisprudence { juridiction: string; date: string; apport: string }
interface Distinction { distinction: string; explication: string }
interface ReferenceCle { reference: string; description: string }
interface StructuredContent {
  title: string
  plan: string[]
  sections: Section[]
  summary: string
  problemesJuridiques?: ProblemeJuridique[]
  articlesEssentiels?: ArticleEssentiel[]
  erreursFrequentes?: ErreurFrequente[]
  logique?: string[]
  schema?: Schema
  jurisprudenceCles?: Jurisprudence[]
  distinctionsCles?: Distinction[]
  referencesCles?: ReferenceCle[]
}
interface Folder { id: string; name: string; color: string }
interface Course {
  id: string
  title: string
  rawContent: string
  structuredContent: StructuredContent
  status: string
  subject?: string
  updatedAt: string
  folderId?: string | null
  folder?: { id: string; name: string; color: string }
}

export default function CoursePage() {
  const id = useParams().id as string
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [folders, setFolders] = useState<Folder[]>([])
  const [showExport, setShowExport] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  function fetchCourse() {
    fetch(`/api/courses/${id}`)
      .then((r) => {
        if (r.status === 404) {
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          setLoading(false)
          setCourse(null)
          return null
        }
        if (!r.ok) throw new Error('error')
        return r.json()
      })
      .then((data: Course | null) => {
        if (!data) return
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

  function startEditTitle() {
    if (!course) return
    setTitleValue(course.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  async function saveTitle() {
    if (!course || !titleValue.trim() || savingTitle) return
    if (titleValue.trim() === course.title) { setEditingTitle(false); return }
    setSavingTitle(true)
    const res = await fetch(`/api/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleValue.trim() }),
    })
    if (res.ok) setCourse(c => c ? { ...c, title: titleValue.trim() } : c)
    setSavingTitle(false)
    setEditingTitle(false)
  }

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
      <div className="text-center">
        <p className="text-gray-700 font-semibold mb-2">Cours introuvable</p>
        <p className="text-gray-400 text-sm mb-4">Ce cours a été supprimé ou n&apos;existe pas.</p>
        <a href="/dashboard" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">
          ← Retour au dashboard
        </a>
      </div>
    </div>
  )

  if (course.status === 'processing') {
    const isTimedOut = elapsed >= 900 // 15 minutes

    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <nav className="border-b dark:border-gray-800 px-6 py-4 flex items-center gap-4">
          <a href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="border dark:border-gray-800 rounded-2xl p-12 bg-white dark:bg-gray-900">
            {isTimedOut ? (
              <>
                <div className="flex justify-center mb-6">
                  <span className="text-5xl">⏱️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Le traitement prend trop de temps</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  Le traitement a dépassé {formatElapsed(elapsed)}. Il est probable que le serveur ait rencontré un problème.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleDelete}
                    className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition text-sm"
                  >
                    Supprimer et recommencer
                  </button>
                  <a href="/dashboard" className="border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 transition text-sm">
                    Retour au dashboard
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-6">
                  <svg className="animate-spin h-12 w-12 text-indigo-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">L&apos;IA restructure ton cours</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Traitement en arrière-plan, cette page se met à jour automatiquement.</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Temps écoulé : <span className="font-mono text-indigo-600">{formatElapsed(elapsed)}</span></p>
                <p className="text-indigo-600 dark:text-indigo-400 text-xs bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">Tu peux fermer cette page — le traitement continue en arrière-plan.</p>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="border-b dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10 gap-2">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm shrink-0">← <span className="hidden sm:inline">Dashboard</span></a>
          {course.folder && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full truncate max-w-[100px] sm:max-w-none">{course.folder.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button onClick={() => setShowRaw(!showRaw)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs border dark:border-gray-700 rounded-lg px-2 py-1.5 hidden sm:block">
            {showRaw ? 'Structuré' : 'Original'}
          </button>
          {course && (
            <AssignFolderButton courseId={course.id} currentFolderId={course.folderId} folders={folders} />
          )}
          {/* Export */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs border dark:border-gray-700 rounded-lg px-2 py-1.5">
              ⬇️ <span className="hidden sm:inline">Exporter</span>
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-9 z-50 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[160px]">
                  <button onClick={() => { window.print(); setShowExport(false) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                    🖨️ PDF (impression)
                  </button>
                  <a href={`/api/courses/${id}/export?format=docx`} onClick={() => setShowExport(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                    📄 Word (.docx)
                  </a>
                  <a href={`/api/courses/${id}/export?format=odt`} onClick={() => setShowExport(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                    📝 LibreOffice (.odt)
                  </a>
                </div>
              </>
            )}
          </div>
          {course && /droit|juridique|loi|jurisprudence/i.test(course.subject || '') && (
            <>
              <a href={`/courses/${id}/methodo`} className="border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition">
                📋 <span className="hidden sm:inline">Méthodo</span>
              </a>
              <a href={`/courses/${id}/correction`} className="border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition">
                ✍️ <span className="hidden sm:inline">Correction</span>
              </a>
              <a href={`/courses/${id}/exercice-guide`} className="border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
                ⚖️ <span className="hidden sm:inline">Exercice</span>
              </a>
              <a href={`/courses/${id}/analyse`} className="border border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 transition">
                🔬 <span className="hidden sm:inline">Analyse</span>
              </a>
            </>
          )}
          <a href={`/courses/${id}/flashcards`} className="border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
            🃏 <span className="hidden sm:inline">Flashcards</span>
          </a>
          <a href={`/courses/${id}/quiz`} className="bg-indigo-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition">
            🧠 <span className="hidden sm:inline">Quiz</span>
          </a>
          <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs px-1.5">🗑️</button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Cours original */}
        {showRaw ? (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-4">{course.title}</h1>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{course.rawContent}</pre>
          </div>
        ) : (
          <>
            {/* Titre — éditable au clic */}
            {editingTitle ? (
              <div className="flex items-center gap-2 mb-6">
                <input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTitle()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  maxLength={200}
                  className="flex-1 text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none py-0.5"
                  autoFocus
                />
                {savingTitle && <span className="text-xs text-gray-400">Sauvegarde…</span>}
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 dark:text-white mb-6 group flex items-center gap-2 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                onClick={startEditTitle}
                title="Cliquer pour modifier le titre"
              >
                {course.title}
                <span className="text-base text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition opacity-0 group-hover:opacity-100">✏️</span>
              </h1>
            )}

            {/* Résumé */}
            {s.summary && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-5 mb-6">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Résumé</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{s.summary}</p>
              </div>
            )}

            {/* Plan du cours */}
            {s.plan && s.plan.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-8">
                <h2 className="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <span>📋</span> Plan du Cours
                </h2>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {s.plan.map((item, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300 text-sm">
                      <button
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 text-left"
                        onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        {typeof item === 'string' ? item : (item as {text?: string}).text || ''}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Logique du cours */}
            {s.logique && s.logique.length > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">🧠 Logique du cours</p>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {s.logique.map((idea, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300 text-sm">{idea}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Sections */}
            {s.sections && s.sections.map((section, i) => (
              <div key={i} id={`section-${i}`} className="mb-10">
                {/* Titre de section */}
                <div className="bg-slate-50 dark:bg-gray-800 border-l-4 border-indigo-500 rounded-r-xl px-5 py-3 mb-5">
                  <h2 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
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
                            <span className="font-semibold text-gray-900 dark:text-white">{n.term}</span>
                            <span className="text-gray-500 dark:text-gray-500"> : </span>
                            <span className="text-gray-700 dark:text-gray-300">{n.definition}</span>
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
                      {section.points.map((point, j) => {
                        // Normalise si le modèle a retourné un objet au lieu d'une string
                        const text = typeof point === 'string'
                          ? point
                          : Object.values(point as Record<string, string>).filter(Boolean).join(' — ')
                        return (
                          <li key={j} className="flex gap-2 text-sm leading-relaxed">
                            <span className="text-gray-400 mt-1 shrink-0">•</span>
                            <span className="text-gray-700 dark:text-gray-300">{text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* À retenir */}
                {section.retenir && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">⚡ À retenir</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{section.retenir}</p>
                  </div>
                )}
              </div>
            ))}
            {/* Schéma / Carte mentale */}
            {s.schema && s.schema.branches?.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-6">🗺️ Carte mentale</p>
                <div className="flex flex-col items-center">
                  {/* Nœud central */}
                  <div className="bg-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-2xl mb-2 text-center shadow">
                    {s.schema.root}
                  </div>
                  <div className="w-px h-6 bg-indigo-300"/>
                  {/* Branches */}
                  <div className="flex flex-wrap justify-center gap-6 w-full mt-2">
                    {s.schema.branches.map((branch, bi) => (
                      <div key={bi} className="flex flex-col items-center w-44">
                        {/* Connecteur */}
                        <div className="w-px h-4 bg-indigo-200 mb-1"/>
                        {/* Label branche */}
                        <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 font-bold text-xs px-3 py-2 rounded-xl text-center mb-2 w-full border border-indigo-200 dark:border-indigo-700">
                          {branch.label}
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          {branch.children?.map((child, ci) => (
                            <div key={ci} className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-1.5 rounded-lg leading-snug">
                              {child}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Articles essentiels */}
            {s.articlesEssentiels && s.articlesEssentiels.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-3">📚 Articles essentiels</p>
                <ul className="space-y-2">
                  {s.articlesEssentiels.map((a, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-semibold text-purple-700 dark:text-purple-300 shrink-0">{a.article}</span>
                      <span className="text-gray-700 dark:text-gray-300">{a.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Références clés (matières hors droit) */}
            {s.referencesCles && s.referencesCles.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-3">📚 Références essentielles</p>
                <ul className="space-y-2">
                  {s.referencesCles.map((r, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-semibold text-purple-700 dark:text-purple-300 shrink-0">{r.reference}</span>
                      <span className="text-gray-700 dark:text-gray-300">{r.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Problèmes types */}
            {s.problemesJuridiques && s.problemesJuridiques.length > 0 && (
              <div className="border dark:border-gray-800 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                  {course.subject === 'Droit' ? '⚖️ Problèmes juridiques types' : '💡 Problèmes types à l\'examen'}
                </p>
                <ul className="space-y-4">
                  {s.problemesJuridiques.map((p, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">{p.question}</p>
                      <p className="text-gray-700 dark:text-gray-300">➡️ Principe : {p.principe}</p>
                      {p.exception && <p className="text-gray-500 dark:text-gray-400 mt-0.5">⚠️ Exception : {p.exception}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Erreurs fréquentes */}
            {s.erreursFrequentes && s.erreursFrequentes.length > 0 && (
              <div className="border border-red-100 dark:border-red-900/30 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">⚠️ Erreurs fréquentes à éviter</p>
                {/* Table sur desktop, liste sur mobile */}
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                        <th className="pb-2 font-medium w-1/2">Erreur</th>
                        <th className="pb-2 font-medium w-1/2">Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.erreursFrequentes.map((e, i) => (
                        <tr key={i} className="border-b dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4 text-red-600 dark:text-red-400">❌ {e.erreur}</td>
                          <td className="py-2 text-green-700 dark:text-green-400">✅ {e.correction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-3">
                  {s.erreursFrequentes.map((e, i) => (
                    <div key={i} className="text-sm space-y-1">
                      <p className="text-red-600 dark:text-red-400">❌ {e.erreur}</p>
                      <p className="text-green-700 dark:text-green-400 pl-3">✅ {e.correction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distinctions clés */}
            {s.distinctionsCles && s.distinctionsCles.length > 0 && (
              <div className="border border-blue-100 dark:border-blue-900/30 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">⚡ Distinctions fondamentales à maîtriser</p>
                <div className="space-y-3">
                  {s.distinctionsCles.map((d, i) => (
                    <div key={i} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                      <p className="font-bold text-blue-800 dark:text-blue-300 mb-1">{d.distinction}</p>
                      <p className="text-gray-700 dark:text-gray-300">{d.explication}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Jurisprudence clés */}
            {s.jurisprudenceCles && s.jurisprudenceCles.length > 0 && (
              <div className="border border-purple-100 dark:border-purple-900/30 rounded-xl p-5 mb-8">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-3">⚖️ Jurisprudence à connaître</p>
                <div className="space-y-3">
                  {s.jurisprudenceCles.map((j, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="shrink-0">
                        <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded text-xs">{j.juridiction}</span>
                        {j.date && <span className="text-gray-400 text-xs ml-1">{j.date}</span>}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{j.apport}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
