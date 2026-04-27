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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: folder.color }} />
            {folder.name}
          </span>
        </div>
        <DeleteFolderButton folderId={folder.id} />
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{folder.courses.length} cours</h2>
          <a href="/courses/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition text-sm">
            + Nouveau cours
          </a>
        </div>

        <div className="bg-white rounded-xl shadow-sm border">
          {folder.courses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📂</p>
              <p>Ce dossier est vide</p>
            </div>
          ) : (
            <ul className="divide-y">
              {folder.courses.map((course) => (
                <li key={course.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
                  <a href={`/courses/${course.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">
                      {course.status === 'processing' ? '⏳' : course.status === 'error' ? '❌' : '📄'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{course.title}</p>
                      <span className="text-xs text-gray-400">
                        {new Date(course.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {course.status === 'ready' && (
                      <div className="flex items-center gap-2">
                        <a href={`/courses/${course.id}/flashcards`} className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 transition">🃏</a>
                        <a href={`/courses/${course.id}/quiz`} className="text-xs text-gray-500 hover:text-indigo-600 border rounded-lg px-2 py-1 hover:border-indigo-300 transition">🧠</a>
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
