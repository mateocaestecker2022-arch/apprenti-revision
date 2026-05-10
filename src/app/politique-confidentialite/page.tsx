import Link from 'next/link'

export const metadata = { title: 'Politique de confidentialité — Apprenti Révision' }

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">← Retour à l'accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-6 mb-8">Politique de confidentialité</h1>

        <div className="space-y-8 text-gray-700 dark:text-gray-300">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Données collectées</h2>
            <p>Lors de votre inscription et utilisation du service, nous collectons :</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Nom et adresse email</strong> — pour l'identification et la communication</li>
              <li><strong>Filière d'études</strong> — pour personnaliser le contenu généré</li>
              <li><strong>Contenu de vos cours uploadés</strong> — traités par IA pour générer les révisions</li>
              <li><strong>Données de révision</strong> — progression, quiz, flashcards (stockées pour le suivi)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Finalité des traitements</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Fournir le service de révision assisté par IA</li>
              <li>Personnaliser les contenus selon votre filière</li>
              <li>Vous envoyer les emails transactionnels (réinitialisation mot de passe)</li>
              <li>Améliorer le service via les suggestions anonymisées</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Base légale (RGPD)</h2>
            <p>Les traitements reposent sur :</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Exécution du contrat</strong> — pour fournir le service auquel vous vous êtes inscrit</li>
              <li><strong>Intérêt légitime</strong> — pour la sécurité et l'amélioration du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Sous-traitants</h2>
            <p>Vos données transitent par :</p>
            <div className="mt-2 space-y-2">
              <p><strong>Groq (GroqCloud)</strong> — traitement IA des contenus de cours. <a href="https://groq.com/privacy" className="text-indigo-600 dark:text-indigo-400" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a></p>
              <p><strong>Hetzner</strong> — hébergement des données en Europe. <a href="https://www.hetzner.com/legal/privacy-policy" className="text-indigo-600 dark:text-indigo-400" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a></p>
              <p><strong>Resend</strong> — envoi d'emails transactionnels.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Durée de conservation</h2>
            <p>Vos données sont conservées pendant toute la durée de votre compte. À la suppression du compte, toutes vos données sont effacées définitivement et immédiatement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Vos droits (RGPD)</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Droit d'accès</strong> — obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> — corriger vos données</li>
              <li><strong>Droit à l'effacement</strong> — supprimer votre compte et toutes vos données</li>
              <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format lisible</li>
              <li><strong>Droit d'opposition</strong> — vous opposer à certains traitements</li>
            </ul>
            <p className="mt-3">Pour exercer ces droits : <a href="mailto:mateocaestecker2022@gmail.com" className="text-indigo-600 dark:text-indigo-400">mateocaestecker2022@gmail.com</a></p>
            <p className="mt-2">Vous pouvez aussi introduire une réclamation auprès de la <strong>CNIL</strong> : <a href="https://www.cnil.fr" className="text-indigo-600 dark:text-indigo-400" target="_blank" rel="noopener noreferrer">www.cnil.fr</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Cookies</h2>
            <p>Le site utilise uniquement des cookies strictement nécessaires au fonctionnement (session d'authentification). Aucun cookie de tracking ou publicitaire n'est utilisé.</p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            Dernière mise à jour : mai 2026
          </p>
        </div>
      </div>
    </div>
  )
}
