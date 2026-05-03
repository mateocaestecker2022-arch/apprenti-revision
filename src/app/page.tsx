import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-gray-900 dark:text-white text-lg">Apprenti Révision</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              Se connecter
            </Link>
            <Link href="/register" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition">
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-indigo-50 via-purple-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
        {/* Cercles décoratifs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-indigo-200 rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-96 h-96 bg-purple-200 rounded-full opacity-20 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            ✨ Propulsé par l&apos;IA
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
            Révise plus vite,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              retiens vraiment.
            </span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Uploade ton cours, l&apos;IA le structure en fiches, quiz, flashcards et exercices juridiques — en quelques minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Commencer gratuitement →
            </Link>
            <Link href="/login" className="border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>

        {/* Mockup cards */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-4 px-4">
          <div className="bg-white rounded-2xl shadow-md border p-4 col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400"/>
              <span className="text-xs text-gray-400 font-medium">Traitement terminé</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-indigo-100 rounded-full w-3/4"/>
              <div className="h-3 bg-gray-100 rounded-full w-full"/>
              <div className="h-3 bg-gray-100 rounded-full w-5/6"/>
              <div className="h-3 bg-purple-100 rounded-full w-2/3"/>
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-md p-4 text-white flex flex-col justify-between">
            <span className="text-3xl">🧠</span>
            <div>
              <p className="font-bold text-sm">Quiz généré</p>
              <p className="text-indigo-200 text-xs">20 questions</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl shadow-sm p-4">
            <span className="text-2xl mb-2 block">🃏</span>
            <p className="font-semibold text-gray-800 text-sm">Flashcards</p>
            <p className="text-gray-400 text-xs">Mode révision</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md border p-4 col-span-2">
            <p className="text-xs text-gray-400 font-medium mb-2">⚖️ Exercice juridique</p>
            <div className="space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded-full w-full"/>
              <div className="h-2.5 bg-gray-100 rounded-full w-4/5"/>
              <div className="h-8 bg-indigo-50 border border-indigo-100 rounded-lg mt-2"/>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-4">
            Tout ce dont tu as besoin pour réviser
          </h2>
          <p className="text-center text-gray-400 dark:text-gray-600 mb-14">Un seul outil, toutes les méthodes.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🤖',
                title: 'Structuration IA',
                desc: 'Ton cours brut devient une fiche structurée avec définitions, points clés, carte mentale et jurisprudence.',
                color: 'from-indigo-50 to-indigo-100',
              },
              {
                icon: '🧠',
                title: 'Quiz QCM',
                desc: '20 questions générées sur mesure. Difficulté variée, explication après chaque réponse.',
                color: 'from-purple-50 to-purple-100',
              },
              {
                icon: '🃏',
                title: 'Flashcards',
                desc: 'Mode révision intelligent : les cartes ratées repassent en boucle jusqu\'à les maîtriser.',
                color: 'from-pink-50 to-pink-100',
              },
              {
                icon: '⚖️',
                title: 'Exercices juridiques',
                desc: 'Cas pratiques, consultations, qualifications juridiques — avec correction IA personnalisée.',
                color: 'from-amber-50 to-amber-100',
              },
              {
                icon: '📁',
                title: 'Classeurs',
                desc: 'Organise tes cours par matière dans des dossiers colorés. Exercices générés pour tout le dossier.',
                color: 'from-emerald-50 to-emerald-100',
              },
              {
                icon: '📄',
                title: 'Export',
                desc: 'Télécharge ta fiche structurée en DOCX, ODT ou imprime en PDF en un clic.',
                color: 'from-sky-50 to-sky-100',
              },
            ].map((f) => (
              <div key={f.title} className={`bg-gradient-to-br ${f.color} dark:bg-none dark:bg-gray-900 rounded-2xl p-6 border border-white dark:border-gray-800`}>
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-4">
            3 étapes, c&apos;est tout
          </h2>
          <p className="text-center text-gray-400 dark:text-gray-600 mb-14">De ton cours brut à une révision complète en quelques minutes.</p>

          <div className="flex flex-col md:flex-row gap-8">
            {[
              { step: '01', icon: '📤', title: 'Upload ton cours', desc: 'PDF, DOCX ou texte brut — on accepte tout. Ton cours est traité automatiquement.' },
              { step: '02', icon: '✨', title: "L'IA structure tout", desc: "Définitions, plan, carte mentale, jurisprudence, erreurs fréquentes — générés en quelques minutes." },
              { step: '03', icon: '🎯', title: 'Révise et progresse', desc: 'Quiz, flashcards, exercices juridiques corrigés par l\'IA. Tu es prêt pour l\'examen.' },
            ].map((s, i) => (
              <div key={i} className="flex-1 bg-white dark:bg-gray-950 rounded-2xl p-6 shadow-sm border dark:border-gray-800 relative">
                <span className="absolute top-4 right-4 text-xs font-bold text-gray-200 dark:text-gray-700">{s.step}</span>
                <span className="text-3xl mb-4 block">{s.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4">
            Prêt à mieux réviser ?
          </h2>
          <p className="text-indigo-200 text-lg mb-10">
            Rejoins Apprenti Révision et transforme tes cours en outils de révision en quelques clics.
          </p>
          <Link href="/register" className="inline-block bg-white text-indigo-600 font-bold text-lg px-10 py-4 rounded-2xl hover:bg-indigo-50 transition shadow-xl">
            Créer mon compte gratuitement →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-sm">
        <p>© 2026 Apprenti Révision — Conçu pour les étudiants</p>
      </footer>

    </div>
  )
}
