import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StuckCoursesSection } from './StuckCoursesSection'

const ADMIN_EMAIL = 'mateocaestecker2022@gmail.com'
const STUCK_MINUTES = 30

export default async function AdminStatsPage() {
  const session = await auth()
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) redirect('/dashboard')

  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)
  const [totalUsers, totalCourses, totalQuizzes, totalSuggestions, stuckCourses] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.quiz.count(),
    prisma.suggestion.count(),
    prisma.course.findMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        subject: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
  ])

  const stats = [
    { label: 'Utilisateurs inscrits', value: totalUsers, icon: '👥', color: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Actifs aujourd\'hui', value: '—', icon: '🟢', color: 'text-green-600 dark:text-green-400', soon: true },
    { label: 'Actifs cette semaine', value: '—', icon: '📅', color: 'text-blue-600 dark:text-blue-400', soon: true },
    { label: 'Cours créés', value: totalCourses, icon: '📄', color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Quiz générés', value: totalQuizzes, icon: '🧠', color: 'text-pink-600 dark:text-pink-400' },
    { label: 'Suggestions reçues', value: totalSuggestions, icon: '💡', color: 'text-amber-600 dark:text-amber-400' },
  ]

  // Visites simulées — à remplacer quand PageVisit sera activé
  const visitsDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label) => ({ label, count: 0 }))
  const maxVisits = 1

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Admin</span>
        <div className="ml-auto flex items-center gap-2">
          <a href="/admin/suggestions" className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
            💡 Suggestions
          </a>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">🔒 Accès restreint</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Statistiques</h1>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.label}</p>
              {'soon' in s && <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 italic">bientôt disponible</p>}
            </div>
          ))}
        </div>

        {/* Graphique visites 7 jours */}
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">📈 Visites — 7 derniers jours</h2>
            <span className="text-xs text-gray-300 dark:text-gray-600 italic">tracking à activer</span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {visitsDays.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{d.count}</span>
                <div
                  className="w-full bg-indigo-200 dark:bg-indigo-900/40 rounded-t-lg"
                  style={{ height: `${Math.max((d.count / maxVisits) * 100, 6)}%` }}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cours bloqués */}
        <StuckCoursesSection initial={stuckCourses.map(c => ({
          ...c,
          updatedAt: c.updatedAt.toISOString(),
        }))} />

      </main>
    </div>
  )
}
