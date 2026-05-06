import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DeleteCourseButton } from '@/components/DeleteCourseButton'
import { CreateFolderButton } from '@/components/CreateFolderButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SuggestionForm } from '@/components/SuggestionForm'
import { AvisForm } from '@/components/AvisForm'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [courses, folders, userInfo, existingAvis, dueCount, flashcardCount] = await Promise.all([
    prisma.course.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { folder: true },
    }),
    prisma.folder.findMany({
      where: { userId: session.user.id },
      include: { _count: { select: { courses: true } } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { filiere: true },
    }),
    prisma.suggestion.findFirst({
      where: { userId: session.user.id, public: true },
    }),
    prisma.flashcardReview.count({
      where: { userId: session.user.id, nextReview: { lte: new Date() } },
    }),
    prisma.flashcard.count({
      where: { course: { userId: session.user.id } },
    }),
  ])

  const ready = courses.filter(c => c.status === 'ready').length
  const processing = courses.filter(c => c.status === 'processing').length
  const firstName = session.user.name?.split(' ')[0] || session.user.email?.split('@')[0] || 'toi'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">

      {/* NAV */}
      <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📚</span>
          <span className="font-extrabold text-indigo-600 text-base sm:text-lg">Apprenti Révision</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">
            👋 {firstName}
          </span>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">Mes révisions</h1>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">Gère tes cours et révise intelligemment</p>
          </div>
          <a href="/courses/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center gap-1.5 shrink-0">
            <span>+</span> Nouveau cours
          </a>
        </div>

        {/* RÉVISION DU JOUR */}
        {flashcardCount > 0 && (
          <a
            href="/revision"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border transition group ${
              dueCount > 0
                ? 'bg-indigo-600 border-indigo-500 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${
              dueCount > 0 ? 'bg-indigo-500' : 'bg-indigo-50 dark:bg-indigo-900/40'
            }`}>
              🧠
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${dueCount > 0 ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                {dueCount > 0
                  ? `${dueCount} carte${dueCount > 1 ? 's' : ''} à réviser aujourd'hui`
                  : 'Révision intelligente — tout est à jour !'}
              </p>
              <p className={`text-xs mt-0.5 ${dueCount > 0 ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {dueCount > 0 ? 'Clique pour commencer' : 'Reviens demain pour ta prochaine session'}
              </p>
            </div>
            <svg className={`w-4 h-4 shrink-0 transition group-hover:translate-x-1 ${dueCount > 0 ? 'text-indigo-200' : 'text-gray-300 dark:text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 shadow-sm border dark:border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-lg shrink-0">📄</div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">{courses.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-tight">Cours</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 shadow-sm border dark:border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center text-lg shrink-0">✅</div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">{ready}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-tight">Prêts</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 shadow-sm border dark:border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center text-lg shrink-0">📁</div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">{folders.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-tight">Classeurs</p>
            </div>
          </div>
        </div>

        {/* CLASSEURS */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Classeurs</h2>
            <CreateFolderButton />
          </div>
          {folders.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center text-gray-400 dark:text-gray-600 flex items-center justify-center gap-2">
              <span>📁</span>
              <p className="text-sm">Aucun classeur — organise tes cours par matière</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {folders.map(f => (
                <a key={f.id} href={`/folders/${f.id}`}
                  className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{f.name}</p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">{f._count.courses} cours</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* TOUS LES COURS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Tous les cours</h2>
            {processing > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {processing} en traitement
              </span>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 p-8 text-center">
              <p className="text-4xl mb-3">📚</p>
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Aucun cours pour l&apos;instant</p>
              <p className="text-gray-400 dark:text-gray-600 text-sm mb-4">Importe ton premier cours PDF ou DOCX</p>
              <a href="/courses/new" className="inline-block bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 transition text-sm">
                Importer un cours →
              </a>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-800 overflow-hidden">
              <ul className="divide-y dark:divide-gray-800">
                {courses.map((course) => (
                  <li key={course.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition group">
                    <a href={`/courses/${course.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0
                        ${course.status === 'processing' ? 'bg-amber-50 dark:bg-amber-900/20' : course.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                        {course.status === 'processing' ? '⏳' : course.status === 'error' ? '❌' : '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{course.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {course.folder && (
                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                              {course.folder.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-600">
                            {new Date(course.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </a>

                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {course.status === 'processing' && (
                        <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2 py-0.5 rounded-full">
                          En traitement…
                        </span>
                      )}
                      {course.status === 'error' && (
                        <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-2 py-0.5 rounded-full">
                          Erreur
                        </span>
                      )}
                      {course.status === 'ready' && (
                        <div className="flex items-center gap-1.5">
                          <a href={`/courses/${course.id}/flashcards`}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border dark:border-gray-700 rounded-lg px-2 py-1 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition" title="Flashcards">
                            🃏
                          </a>
                          <a href={`/courses/${course.id}/quiz`}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border dark:border-gray-700 rounded-lg px-2 py-1 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition" title="Quiz">
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

        {/* BAS DE PAGE : Paramètres à gauche, Suggestion + Avis à droite */}
        <div className="mt-4 flex flex-col lg:flex-row gap-4 items-start">

          {/* Droite : Suggestion + Avis */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Suggestion */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-800 p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">💡 Suggestion</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Une idée, un bug, une amélioration ? Je lis tout.
                </p>
              </div>
              <SuggestionForm />
            </div>

            {/* Avis — masqué si déjà soumis */}
            {!existingAvis && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-800 p-5">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">⭐ Laisser un avis</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Affiché sur la page d&apos;accueil pour les futurs utilisateurs.
                  </p>
                </div>
                <AvisForm filiere={userInfo?.filiere || 'Général'} />
              </div>
            )}

          </div>

          {/* Gauche : Paramètres */}
          <div className="w-full lg:w-60 shrink-0 lg:order-first">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b dark:border-gray-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">⚙️ Paramètres</h2>
              </div>
              <div className="divide-y dark:divide-gray-800">
                <a href="/account/password" className="flex items-center gap-3 px-5 py-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition">
                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">Mot de passe</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Modifier mon mot de passe</p>
                  </div>
                </a>
                <a href="/api/auth/signout" className="flex items-center gap-3 px-5 py-4 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition group">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition">
                    <svg className="w-4 h-4 text-orange-500 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition">Déconnexion</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Quitter ma session</p>
                  </div>
                </a>
                <a href="/account/delete" className="flex items-center gap-3 px-5 py-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition group">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition">
                    <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-500 dark:text-red-400">Supprimer le compte</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Action irréversible</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
