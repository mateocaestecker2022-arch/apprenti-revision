import Link from 'next/link'

export const metadata = { title: 'Mentions légales — Apprenti Révision' }

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">← Retour à l'accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-6 mb-8">Mentions légales</h1>

        <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Éditeur du site</h2>
            <p>Le site <strong>Apprenti Révision</strong> est un service en ligne à destination des étudiants.</p>
            <p>Responsable de publication : Mateo Caestecker</p>
            <p>Contact : <a href="mailto:mateocaestecker2022@gmail.com" className="text-indigo-600 dark:text-indigo-400">mateocaestecker2022@gmail.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Hébergement</h2>
            <p>Le site est hébergé par :</p>
            <p><strong>Hetzner Online GmbH</strong><br />
            Industriestr. 25, 91710 Gunzenhausen, Allemagne<br />
            <a href="https://www.hetzner.com" className="text-indigo-600 dark:text-indigo-400" target="_blank" rel="noopener noreferrer">www.hetzner.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Propriété intellectuelle</h2>
            <p>L'ensemble du contenu du site (textes, images, interface) est protégé par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
            <p>Les contenus générés par l'intelligence artificielle à partir des cours fournis par l'utilisateur restent la propriété de l'utilisateur concerné.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Limitation de responsabilité</h2>
            <p>Les contenus générés automatiquement par intelligence artificielle (résumés, quiz, flashcards) sont fournis à titre indicatif et pédagogique uniquement. Ils ne sauraient se substituer à un enseignement officiel ou à un conseil professionnel.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Droit applicable</h2>
            <p>Le présent site est soumis au droit français. Tout litige relatif à son utilisation sera soumis aux juridictions compétentes françaises.</p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            Dernière mise à jour : mai 2026
          </p>
        </div>
      </div>
    </div>
  )
}
