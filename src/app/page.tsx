import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')

  const avis = await prisma.suggestion.findMany({
    where: { public: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, anonymous: true, user: { select: { name: true, filiere: true } } },
  })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-extrabold text-gray-900 dark:text-white text-base tracking-tight">Apprenti Révision</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hidden sm:block">
              Se connecter
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm">
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-28 pb-20 px-4 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 relative overflow-hidden">
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-indigo-300 rounded-full opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-300 rounded-full opacity-10 blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            Propulsé par l&apos;IA · Gratuit
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-5 tracking-tight">
            Révise plus vite,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              retiens vraiment.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Uploade ton cours PDF ou DOCX — l&apos;IA le transforme en fiches structurées, quiz, flashcards et exercices corrigés. Pour toutes les filières.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="bg-indigo-600 text-white px-7 py-3.5 rounded-xl font-bold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
              Créer mon compte gratuitement →
            </Link>
            <Link href="/login" className="border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-7 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              J&apos;ai déjà un compte
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">Aucune carte bancaire requise · Accès immédiat</p>
        </div>

        {/* Mockup */}
        <div className="hidden sm:grid max-w-2xl mx-auto mt-14 grid-cols-3 gap-3 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 p-4 col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400 font-medium">Cours structuré · prêt</span>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full w-3/4" />
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-full" />
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-5/6" />
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-4/5" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-4 text-white flex flex-col justify-between">
            <span className="text-3xl">🧠</span>
            <div>
              <p className="font-bold text-sm">Quiz généré</p>
              <p className="text-indigo-200 text-xs">20 questions</p>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl shadow-sm p-4">
            <span className="text-2xl mb-2 block">🃏</span>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">Flashcards</p>
            <p className="text-gray-400 text-xs mt-0.5">Mode révision</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 p-4 col-span-2">
            <p className="text-xs text-gray-400 font-medium mb-2">✍️ Exercice pratique</p>
            <div className="space-y-1.5">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-full" />
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-4/5" />
              <div className="h-7 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-lg mt-2" />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 px-4 bg-white dark:bg-gray-950 border-y border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: '9', label: 'filières supportées' },
            { value: '5 min', label: 'pour structurer un cours' },
            { value: '100%', label: 'gratuit' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{s.value}</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
              Tout ce dont tu as besoin pour réviser
            </h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm max-w-xl mx-auto">Un seul outil, toutes les méthodes. Adapté à chaque filière.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              { icon: '🤖', title: 'Structuration IA', desc: 'Ton cours brut devient une fiche structurée avec définitions, points clés, carte mentale et références.', color: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/30' },
              { icon: '🧠', title: 'Quiz QCM', desc: '20 questions générées sur mesure. Difficulté variée, explication après chaque réponse.', color: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800/30' },
              { icon: '🃏', title: 'Flashcards', desc: 'Mode révision intelligent : les cartes ratées repassent en boucle jusqu\'à les maîtriser.', color: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-100 dark:border-pink-800/30' },
              { icon: '✍️', title: 'Exercices pratiques', desc: 'Exercices adaptés à ta matière avec correction IA personnalisée et feedback détaillé.', color: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30' },
              { icon: '📁', title: 'Classeurs', desc: 'Organise tes cours par matière dans des dossiers colorés. Exercices générés pour tout le dossier.', color: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30' },
              { icon: '📄', title: 'Export', desc: 'Télécharge ta fiche structurée en DOCX, ODT ou imprime en PDF en un clic.', color: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-100 dark:border-sky-800/30' },
            ].map((f) => (
              <div key={f.title} className={`${f.color} border ${f.border} rounded-2xl p-6 hover:shadow-md transition-shadow`}>
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
              3 étapes, c&apos;est tout
            </h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm">De ton cours brut à une révision complète en quelques minutes.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-0 sm:gap-0 relative">
            {/* Ligne de connexion desktop */}
            <div className="hidden sm:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-indigo-200 dark:bg-indigo-800/50 z-0" />

            {[
              { step: '1', icon: '📤', title: 'Upload ton cours', desc: 'PDF, DOCX ou texte — on accepte tout. Ton cours est traité automatiquement.' },
              { step: '2', icon: '✨', title: "L'IA structure tout", desc: 'Définitions, plan, carte mentale, erreurs fréquentes — générés en quelques minutes.' },
              { step: '3', icon: '🎯', title: 'Révise et progresse', desc: 'Quiz, flashcards, exercices corrigés par l\'IA. Tu es prêt pour l\'examen.' },
            ].map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center px-6 py-6 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-950 border-2 border-indigo-200 dark:border-indigo-700 shadow-md flex items-center justify-center text-2xl mb-4">
                  {s.icon}
                </div>
                <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 mb-1">Étape {s.step}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/register" className="inline-block bg-indigo-600 text-white px-7 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-md shadow-indigo-200 dark:shadow-none">
              Essayer maintenant →
            </Link>
          </div>
        </div>
      </section>

      {/* AVIS */}
      {avis.length > 0 && (
        <section className="py-20 px-4 bg-white dark:bg-gray-950">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
                Ce qu&apos;ils en pensent
              </h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Des étudiants qui utilisent Apprenti Révision au quotidien.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {avis.map((a) => (
                <div key={a.id} className="bg-slate-50 dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  {/* Étoiles */}
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex-1">&ldquo;{a.content}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-3 border-t dark:border-gray-800">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                      {a.anonymous ? '?' : (a.user.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {a.anonymous ? 'Anonyme' : (a.user.name || 'Étudiant')}
                      </p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        {a.anonymous ? 'Étudiant' : a.user.filiere}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-10">
              Tu utilises Apprenti Révision ?{' '}
              <a href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                Connecte-toi pour laisser un avis →
              </a>
            </p>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-4 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
        </div>
        <div className="max-w-xl mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Prêt à mieux réviser ?
          </h2>
          <p className="text-indigo-200 text-sm sm:text-base mb-8 leading-relaxed">
            Rejoins Apprenti Révision et transforme tes cours en outils de révision en quelques clics.
          </p>
          <Link href="/register" className="inline-block bg-white text-indigo-600 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-indigo-50 transition shadow-2xl">
            Créer mon compte gratuitement →
          </Link>
          <p className="text-indigo-300 text-xs mt-4">Aucune carte bancaire requise</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-500 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <span className="font-bold text-gray-400 text-sm">Apprenti Révision</span>
          </div>
          <p className="text-xs">© 2026 Apprenti Révision — Conçu pour les étudiants</p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/login" className="hover:text-gray-300 transition">Se connecter</Link>
            <Link href="/register" className="hover:text-gray-300 transition">Créer un compte</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
