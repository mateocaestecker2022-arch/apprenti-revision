import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DeleteCourseButton } from '@/components/DeleteCourseButton'
import { DeleteFolderButton } from '@/components/DeleteFolderButton'

export default async function FolderPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      courses: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  if (!folder) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: folder.color }} />
            {folder.name}
          </span>
        </div>
        <DeleteFolderButton folderId={folder.id} />
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{folder.courses.length} cours</h2>
          <div className="flex items-center gap-2">
            {folder.courses.some(c => c.status === 'ready') && (
              <a href={`/folders/${folder.id}/exercises`} className="border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-sm">
                ✍️ Exercices
              </a>
            )}
            <a href="/courses/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition text-sm">
              + Nouveau cours
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800">
          {folder.courses.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600">
              <p className="text-4xl mb-3">📂</p>
              <p>Ce dossier est vide</p>
            </div>
          ) : (
            <ul className="divide-y dark:divide-gray-800">
              {folder.courses.map((course) => (
                <li key={course.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition">
                  <a href={`/courses/${course.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">
                      {course.status === 'processing' ? '⏳' : course.status === 'error' ? '❌' : '📄'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{course.title}</p>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(course.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {course.status === 'ready' && (
                      <div className="flex items-center gap-2">
                        <a href={`/courses/${course.id}/flashcards`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border dark:border-gray-700 rounded-lg px-2 py-1 hover:border-indigo-300 dark:hover:border-indigo-600 transition">🃏</a>
                        <a href={`/courses/${course.id}/quiz`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border dark:border-gray-700 rounded-lg px-2 py-1 hover:border-indigo-300 dark:hover:border-indigo-600 transition">🧠</a>
                      </div>
                    )}
                    <DeleteCourseButton courseId={course.id} />
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
