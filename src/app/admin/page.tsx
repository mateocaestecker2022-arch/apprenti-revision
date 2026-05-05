import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StuckCoursesSection } from './StuckCoursesSection'

const ADMIN_USER_ID = 'cmohf50fk000a6k88biaq9yza'
const STUCK_MINUTES = 30

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default async function AdminStatsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) redirect('/dashboard')

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0)
  const cutoff = new Date(now.getTime() - STUCK_MINUTES * 60 * 1000)

  const [
    totalUsers,
    totalCourses,
    totalQuizzes,
    totalSuggestions,
    activeTodayCount,
    activeWeekCount,
    stuckCourses,
    recentCourses,
    users,
    recentSuggestions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.quiz.count(),
    prisma.suggestion.count(),
    prisma.user.count({ where: { courses: { some: { createdAt: { gte: todayStart } } } } }),
    prisma.user.count({ where: { courses: { some: { createdAt: { gte: weekStart } } } } }),
    prisma.course.findMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      select: {
        id: true, title: true, updatedAt: true, subject: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.course.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        filiere: true,
        createdAt: true,
        _count: { select: { courses: true } },
        courses: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.suggestion.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, filiere: true } } },
    }),
  ])

  // Graphique 7 jours
  const days: { label: string; ts: number; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    days.push({ label: DAY_LABELS[d.getDay()], ts: d.getTime(), count: 0 })
  }
  for (const c of recentCourses) {
    const d = new Date(c.createdAt); d.setHours(0, 0, 0, 0)
    const slot = days.find(day => day.ts === d.getTime())
    if (slot) slot.count++
  }
  const maxActivity = Math.max(...days.map(d => d.count), 1)

  const stats = [
    { label: 'Utilisateurs inscrits', value: totalUsers, icon: '👥', color: 'text-indigo-600 dark:text-indigo-400' },
    { label: "Actifs aujourd'hui", value: activeTodayCount, icon: '🟢', color: 'text-green-600 dark:text-green-400' },
    { label: 'Actifs cette semaine', value: activeWeekCount, icon: '📅', color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Cours créés', value: totalCourses, icon: '📄', color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Quiz générés', value: totalQuizzes, icon: '🧠', color: 'text-pink-600 dark:text-pink-400' },
    { label: 'Suggestions reçues', value: totalSuggestions, icon: '💡', color: 'text-amber-600 dark:text-amber-400' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">← Dashboard</a>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="font-bold text-indigo-600">Admin</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">🔒 Accès restreint</span>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── STATS ── */}
        <section>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">Statistiques</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 shadow-sm">
                <p className="text-2xl mb-2">{s.icon}</p>
                <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── GRAPHIQUE 7 JOURS ── */}
        <section className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">📈 Activité — 7 derniers jours</h2>
          <div className="flex items-end gap-2 h-32">
            {days.map((d) => (
              <div key={d.ts} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{d.count > 0 ? d.count : ''}</span>
                <div
                  className="w-full bg-indigo-500 dark:bg-indigo-600 rounded-t-lg transition-all"
                  style={{ height: `${Math.max((d.count / maxActivity) * 100, 4)}%` }}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">Cours créés par jour</p>
        </section>

        {/* ── UTILISATEURS ── */}
        <section>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">👥 Utilisateurs</h2>
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Nom</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Filière</th>
                    <th className="px-4 py-3 font-semibold">Inscription</th>
                    <th className="px-4 py-3 font-semibold">Dernière activité</th>
                    <th className="px-4 py-3 font-semibold text-right">Cours</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const lastActivity = u.courses[0]?.createdAt ?? u.createdAt
                    return (
                      <tr key={u.id} className="border-b dark:border-gray-800 last:border-0 hover:bg-slate-50 dark:hover:bg-gray-800/30 transition">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{u.name || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">{u.filiere}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                          {new Date(lastActivity).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{u._count.courses}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── SUGGESTIONS ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">💡 Suggestions récentes</h2>
            {totalSuggestions > 0 && (
              <a href="/admin/suggestions" className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
                Voir toutes ({totalSuggestions})
              </a>
            )}
          </div>
          {recentSuggestions.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-10 text-center shadow-sm">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Aucune suggestion pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSuggestions.map((s) => (
                <div key={s.id} className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                        {(s.user.name || s.user.email)?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{s.user.name || 'Anonyme'}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:block">{s.user.email}</span>
                      <span className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded shrink-0">{s.user.filiere}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-3">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{s.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── COURS BLOQUÉS ── */}
        <StuckCoursesSection initial={stuckCourses.map(c => ({
          ...c,
          updatedAt: c.updatedAt.toISOString(),
        }))} />

      </main>
    </div>
  )
}
