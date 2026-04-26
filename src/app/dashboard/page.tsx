import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [courseCount, folderCount] = await Promise.all([
    prisma.course.count({ where: { userId: session.user.id } }),
    prisma.folder.count({ where: { userId: session.user.id } }),
  ])

  const recentCourses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { folder: true },
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">Apprenti Révision</h1>
        <span className="text-sm text-gray-500">Bonjour, {session.user.name || session.user.email}</span>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Cours</p>
            <p className="text-3xl font-bold text-indigo-600">{courseCount}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Dossiers</p>
            <p className="text-3xl font-bold text-purple-600">{folderCount}</p>
          </div>
        </div>

        {/* Cours récents */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Cours récents</h3>
            <a href="/courses/new" className="text-sm text-indigo-600 hover:underline font-medium">
              + Nouveau cours
            </a>
          </div>

          {recentCourses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="mb-2">Aucun cours pour l&apos;instant</p>
              <a href="/courses/new" className="text-indigo-600 text-sm font-medium hover:underline">
                Importer votre premier cours
              </a>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentCourses.map((course) => (
                <li key={course.id}>
                  <a
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{course.title}</p>
                      {course.folder && (
                        <p className="text-xs text-gray-400">{course.folder.name}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(course.updatedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
