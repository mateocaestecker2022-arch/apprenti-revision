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

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">Apprenti Révision</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session.user.name || session.user.email}</span>
          <a href="/api/auth/signout" className="text-sm text-gray-400 hover:text-gray-600">Déconnexion</a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Mes cours</h2>
          <a href="/courses/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition text-sm">
            + Nouveau cours
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
            <p className="text-3xl font-bold text-indigo-600">{courses.length}</p>
            <p className="text-sm text-gray-500 mt-1">Cours total</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
            <p className="text-3xl font-bold text-green-600">{ready}</p>
            <p className="text-sm text-gray-500 mt-1">Prêts</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border text-center">
            <p className="text-3xl font-bold text-purple-600">{folders.length}</p>
            <p className="text-sm text-gray-500 mt-1">Dossiers</p>
          </div>
        </div>

        {/* Dossiers */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Classeurs</h3>
            <CreateFolderButton />
          </div>
          {folders.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun classeur — crée-en un pour organiser tes cours.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {folders.map(f => (
                <a key={f.id} href={`/folders/${f.id}`} className="bg-white border rounded-xl p-4 flex items-center gap-3 hover:border-indigo-300 hover:shadow-sm transition">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{f._count.courses} cours</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Tous les cours */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Tous les cours</h3>
            {processing > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                {processing} en cours de traitement…
              </span>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📚</p>
              <p className="mb-1">Aucun cours pour l&apos;instant</p>
              <a href="/courses/new" className="text-indigo-600 text-sm font-medium hover:underline">
                Importer votre premier cours →
              </a>
            </div>
          ) : (
            <ul className="divide-y">
              {courses.map((course) => (
                <li key={course.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
                  <a href={`/courses/${course.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">
                      {course.status === 'processing' ? '⏳' : course.status === 'error' ? '❌' : '📄'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{course.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {course.folder && (
                          <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {course.folder.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(course.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {course.status === 'processing' && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        En traitement
                      </span>
                    )}
                    {course.status === 'error' && (
                      <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        Erreur
                      </span>
                    )}
                    {course.status === 'ready' && (
                      <div className="flex items-center gap-2">
                        <a href={`/courses/${course.id}/flashcards`} className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 transition">
                          🃏
                        </a>
                        <a href={`/courses/${course.id}/quiz`} className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 transition">
                          🧠
                        </a>
                      </div>
                    )}
                    <DeleteCourseButton courseId={course.id} />
                    <span className="text-gray-300">→</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
