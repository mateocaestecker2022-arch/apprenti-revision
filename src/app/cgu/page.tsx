import Link from 'next/link'

export const metadata = { title: 'Conditions Générales d\'Utilisation — Apprenti Révision' }

export default function CGU() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">← Retour à l'accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-6 mb-8">Conditions Générales d'Utilisation</h1>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Objet</h2>
            <p>Les présentes CGU définissent les conditions d'accès et d'utilisation du service <strong>Apprenti Révision</strong>, plateforme d'aide à la révision pour étudiants utilisant l'intelligence artificielle.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Accès au service</h2>
            <p>L'accès au service est gratuit et nécessite la création d'un compte avec une adresse email valide. L'utilisateur est responsable de la confidentialité de ses identifiants.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Utilisation du service</h2>
            <p>L'utilisateur s'engage à :</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>N'uploader que des contenus dont il est l'auteur ou qu'il a le droit d'utiliser</li>
              <li>Ne pas tenter de contourner les mécanismes de sécurité</li>
              <li>Ne pas utiliser le service à des fins commerciales sans autorisation</li>
              <li>Ne pas uploader de contenus illicites, offensants ou portant atteinte aux droits de tiers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Contenu généré par IA</h2>
            <p>Les résumés, quiz, flashcards et exercices sont générés automatiquement par intelligence artificielle. Ces contenus sont fournis <strong>à titre pédagogique uniquement</strong> et peuvent contenir des inexactitudes. Ils ne remplacent pas un enseignement officiel.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Disponibilité du service</h2>
            <p>Le service est fourni "tel quel". Nous ne garantissons pas une disponibilité continue et nous réservons le droit d'interrompre ou de modifier le service à tout moment.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Suppression de compte</h2>
            <p>L'utilisateur peut supprimer son compte à tout moment depuis les paramètres. La suppression entraîne l'effacement définitif de toutes ses données.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Modifications des CGU</h2>
            <p>Nous nous réservons le droit de modifier les présentes CGU. Les utilisateurs seront informés des changements significatifs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Contact</h2>
            <p>Pour toute question : <a href="mailto:mateocaestecker2022@gmail.com" className="text-indigo-600 dark:text-indigo-400">mateocaestecker2022@gmail.com</a></p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            Dernière mise à jour : mai 2026
          </p>
        </div>
      </div>
    </div>
  )
}
