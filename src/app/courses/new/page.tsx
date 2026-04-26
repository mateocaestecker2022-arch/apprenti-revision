'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCoursePage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setFileName(file.name)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erreur lors de la lecture du fichier')
      setUploading(false)
      setFileName('')
      return
    }

    const { text } = await res.json()
    setContent(text)
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 10) {
      setError('Le cours est trop court')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erreur lors du traitement')
      setLoading(false)
      return
    }

    const { id } = await res.json()
    router.push(`/courses/${id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <a href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</a>
        <h1 className="text-lg font-bold text-indigo-600">Nouveau cours</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-black mb-2">Importer un cours</h2>
          <p className="text-gray-600 mb-6">
            Importe un fichier ou colle ton cours ci-dessous. L&apos;IA va le restructurer avec un plan, des définitions et un développement détaillé.
          </p>

          {/* Zone d'upload fichier */}
          <div
            className="border-2 border-dashed border-indigo-200 rounded-xl p-8 mb-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.odt,.pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <p className="text-indigo-600 font-medium">Lecture du fichier...</p>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-600 font-medium">{fileName} importé</p>
                <p className="text-gray-400 text-sm">Clique pour changer de fichier</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-black font-medium">Clique pour importer un fichier</p>
                <p className="text-gray-500 text-sm">Word (.docx), LibreOffice (.odt), PDF (.pdf), Texte (.txt)</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200"/>
            <span className="text-gray-400 text-sm">ou colle ton cours</span>
            <div className="flex-1 h-px bg-gray-200"/>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="Colle ton cours ici..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-black resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">{content.length} caractères</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploading || content.trim().length < 10}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  L&apos;IA restructure votre cours...
                </>
              ) : (
                'Restructurer avec l\'IA'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
