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
    include: { user: { select: { name: true, filiere: true } } },
  })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-bold text-gray-900 dark:text-white text-base">Apprenti Révision</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              Se connecter
            </Link>
            <Link href="/register" className="text-sm font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition">
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-14 px-4 bg-gradient-to-b from-indigo-50 via-purple-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
        <div className="absolute top-16 left-1/4 w-48 h-48 bg-indigo-200 rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute top-24 right-1/4 w-64 h-64 bg-purple-200 rounded-full opacity-20 blur-3xl pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative">
          <span className="inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-5">
            ✨ Propulsé par l&apos;IA
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
            Révise plus vite,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              retiens vraiment.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Uploade ton cours, l&apos;IA le structure en fiches, quiz et flashcards — en quelques minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none">
              Commencer gratuitement →
            </Link>
            <Link href="/login" className="border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold text-base hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>

        {/* Mockup cards — masqué sur très petit écran */}
        <div className="hidden sm:grid max-w-2xl mx-auto mt-12 grid-cols-3 gap-3 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border dark:border-gray-700 p-3 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400"/>
              <span className="text-xs text-gray-400 font-medium">Traitement terminé</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full w-3/4"/>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full w-full"/>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full w-5/6"/>
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-md p-3 text-white flex flex-col justify-between">
            <span className="text-2xl">🧠</span>
            <div>
              <p className="font-bold text-xs">Quiz généré</p>
              <p className="text-indigo-200 text-xs">20 questions</p>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl shadow-sm p-3">
            <span className="text-xl mb-1 block">🃏</span>
            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">Flashcards</p>
            <p className="text-gray-400 text-xs">Mode révision</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border dark:border-gray-700 p-3 col-span-2">
            <p className="text-xs text-gray-400 font-medium mb-2">✍️ Exercice pratique</p>
            <div className="space-y-1">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-full"/>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full w-4/5"/>
              <div className="h-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-lg mt-1.5"/>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-14 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
            Tout ce dont tu as besoin pour réviser
          </h2>
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm mb-10">Un seul outil, toutes les méthodes.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🤖',
                title: 'Structuration IA',
                desc: 'Ton cours brut devient une fiche structurée avec définitions, points clés, carte mentale et références.',
                color: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/10',
              },
              {
                icon: '🧠',
                title: 'Quiz QCM',
                desc: '20 questions générées sur mesure. Difficulté variée, explication après chaque réponse.',
                color: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10',
              },
              {
                icon: '🃏',
                title: 'Flashcards',
                desc: 'Mode révision intelligent : les cartes ratées repassent en boucle jusqu\'à les maîtriser.',
                color: 'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-900/10',
              },
              {
                icon: '✍️',
                title: 'Exercices pratiques',
                desc: 'Exercices adaptés à ta matière avec correction IA personnalisée et feedback détaillé.',
                color: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10',
              },
              {
                icon: '📁',
                title: 'Classeurs',
                desc: 'Organise tes cours par matière dans des dossiers colorés. Exercices générés pour tout le dossier.',
                color: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10',
              },
              {
                icon: '📄',
                title: 'Export',
                desc: 'Télécharge ta fiche structurée en DOCX, ODT ou imprime en PDF en un clic.',
                color: 'from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-900/10',
              },
            ].map((f) => (
              <div key={f.title} className={`bg-gradient-to-br ${f.color} rounded-xl p-5 border border-white dark:border-gray-800`}>
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-14 px-4 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
            3 étapes, c&apos;est tout
          </h2>
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm mb-10">De ton cours brut à une révision complète en quelques minutes.</p>

          <div className="flex flex-col sm:flex-row gap-4">
            {[
              { step: '01', icon: '📤', title: 'Upload ton cours', desc: 'PDF, DOCX ou texte brut — on accepte tout. Ton cours est traité automatiquement.' },
              { step: '02', icon: '✨', title: "L'IA structure tout", desc: "Définitions, plan, carte mentale, erreurs fréquentes — générés en quelques minutes." },
              { step: '03', icon: '🎯', title: 'Révise et progresse', desc: 'Quiz, flashcards, exercices corrigés par l\'IA. Tu es prêt pour l\'examen.' },
            ].map((s, i) => (
              <div key={i} className="flex-1 bg-white dark:bg-gray-950 rounded-xl p-5 shadow-sm border dark:border-gray-800 relative">
                <span className="absolute top-3 right-3 text-xs font-bold text-gray-200 dark:text-gray-700">{s.step}</span>
                <span className="text-2xl mb-3 block">{s.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AVIS */}
      {avis.length > 0 && (
        <section className="py-14 px-4 bg-white dark:bg-gray-950">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
              Ce qu&apos;ils en pensent
            </h2>
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mb-10">Des étudiants qui utilisent Apprenti Révision au quotidien.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {avis.map((a) => (
                <div key={a.id} className="bg-slate-50 dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex-1">&ldquo;{a.content}&rdquo;</p>
                  <div className="flex items-center gap-2 pt-2 border-t dark:border-gray-800">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                      {(a.user.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{a.user.name || 'Étudiant'}</p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">{a.user.filiere}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="py-14 px-4 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Prêt à mieux réviser ?
          </h2>
          <p className="text-indigo-200 text-sm sm:text-base mb-8">
            Rejoins Apprenti Révision et transforme tes cours en outils de révision en quelques clics.
          </p>
          <Link href="/register" className="inline-block bg-white text-indigo-600 font-bold text-base px-8 py-3 rounded-xl hover:bg-indigo-50 transition shadow-xl">
            Créer mon compte gratuitement →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-6 px-4 text-center text-xs">
        <p>© 2026 Apprenti Révision — Conçu pour les étudiants</p>
      </footer>

    </div>
  )
}
