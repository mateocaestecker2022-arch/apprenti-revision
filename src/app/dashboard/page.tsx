import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DeleteCourseButton } from '@/components/DeleteCourseButton'
import { CreateFolderButton } from '@/components/CreateFolderButton'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [courses, folders] = await Promise.all([
    prisma.course.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { folder: true },
    }),
    prisma.folder.findMany({
      where: { userId: session.user.id },
      include: { _count: { select: { courses: true } } },
    }),
  ])

  const ready = courses.filter(c => c.status === 'ready').length
  const processing = courses.filter(c => c.status === 'processing').length
  const firstName = session.user.name?.split(' ')[0] || session.user.email?.split('@')[0] || 'toi'

  return (
    <div className="min-h-screen bg-slate-50">

      {/* NAV */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <span className="font-extrabold text-indigo-600 text-lg">Apprenti Révision</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 hidden sm:block">
            👋 {firstName}
          </span>
          <a href="/api/auth/signout" className="text-xs text-gray-400 hover:text-red-500 transition border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200">
            Déconnexion
          </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Mes révisions</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gère tes cours et révise intelligemment</p>
          </div>
          <a href="/courses/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm shadow-md shadow-indigo-200 flex items-center gap-2">
            <span>+</span> Nouveau cours
          </a>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl shrink-0">📄</div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{courses.length}</p>
              <p className="text-xs text-gray-400 font-medium">Cours total</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl shrink-0">✅</div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{ready}</p>
              <p className="text-xs text-gray-400 font-medium">Prêts à réviser</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl shrink-0">📁</div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{folders.length}</p>
              <p className="text-xs text-gray-400 font-medium">Classeurs</p>
            </div>
          </div>
        </div>

        {/* CLASSEURS */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Classeurs</h2>
            <CreateFolderButton />
          </div>
          {folders.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400">
              <p className="text-3xl mb-2">📁</p>
              <p className="text-sm">Aucun classeur — organise tes cours par matière</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {folders.map(f => (
                <a key={f.id} href={`/folders/${f.id}`}
                  className="bg-white border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-indigo-600 transition">{f.name}</p>
                  </div>
                  <p className="text-xs text-gray-400">{f._count.courses} cours</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* TOUS LES COURS */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Tous les cours</h2>
            {processing > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {processing} en traitement
              </span>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
              <p className="text-5xl mb-4">📚</p>
              <p className="font-semibold text-gray-700 mb-1">Aucun cours pour l&apos;instant</p>
              <p className="text-gray-400 text-sm mb-6">Importe ton premier cours PDF ou DOCX</p>
              <a href="/courses/new" className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition text-sm">
                Importer un cours →
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <ul className="divide-y">
                {courses.map((course) => (
                  <li key={course.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition group">
                    <a href={`/courses/${course.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0
                        ${course.status === 'processing' ? 'bg-amber-50' : course.status === 'error' ? 'bg-red-50' : 'bg-indigo-50'}`}>
                        {course.status === 'processing' ? '⏳' : course.status === 'error' ? '❌' : '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate group-hover:text-indigo-600 transition">{course.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {course.folder && (
                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {course.folder.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(course.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </a>

                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {course.status === 'processing' && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          En traitement…
                        </span>
                      )}
                      {course.status === 'error' && (
                        <span className="text-xs text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                          Erreur
                        </span>
                      )}
                      {course.status === 'ready' && (
                        <div className="flex items-center gap-1.5">
                          <a href={`/courses/${course.id}/flashcards`}
                            className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 hover:bg-indigo-50 transition" title="Flashcards">
                            🃏
                          </a>
                          <a href={`/courses/${course.id}/quiz`}
                            className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 hover:bg-indigo-50 transition" title="Quiz">
                            🧠
                          </a>
                        </div>
                      )}
                      <DeleteCourseButton courseId={course.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
