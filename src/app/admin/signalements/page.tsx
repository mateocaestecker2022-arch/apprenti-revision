import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@apprenti-revision.fr'

export default async function SignalementsPage() {
  const session = await auth()
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) redirect('/dashboard')

  const signalements = await prisma.signalement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-xl font-bold mb-6">Signalements — {signalements.length}</h1>
      <div className="space-y-4">
        {signalements.map(s => (
          <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                s.probleme === 'article_invente' ? 'bg-red-900/50 text-red-400' :
                s.probleme === 'erreur_juridique' ? 'bg-orange-900/50 text-orange-400' :
                'bg-gray-800 text-gray-400'
              }`}>{s.probleme}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{s.type}</span>
              {s.niveau && <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-1 rounded-full">{s.niveau}</span>}
              <span className="text-xs text-gray-500 ml-auto">{new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
            {s.commentaire && <p className="text-sm text-gray-300 mb-2">💬 {s.commentaire}</p>}
            <details>
              <summary className="text-xs text-gray-500 cursor-pointer">Contenu IA signalé</summary>
              <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap line-clamp-6">{s.contenuIA}</p>
            </details>
          </div>
        ))}
        {signalements.length === 0 && (
          <p className="text-gray-500 text-center py-12">Aucun signalement pour l&apos;instant.</p>
        )}
      </div>
    </div>
  )
}
