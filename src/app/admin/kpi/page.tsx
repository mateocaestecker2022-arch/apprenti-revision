import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function KpiPage() {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAIL || session.user.email !== ADMIN_EMAIL) redirect('/dashboard')

  const [
    totalSignalements,
    signalementsParType,
    totalExercices,
    exercicesTermines,
    totalMethodos,
    correctionScores,
    newUsers7j,
    totalUsers,
    coursesReady,
  ] = await Promise.all([
    prisma.signalement.count(),
    prisma.signalement.groupBy({ by: ['probleme'], _count: true, orderBy: { _count: { probleme: 'desc' } } }),
    prisma.exerciceGuide.count(),
    prisma.exerciceGuide.count({ where: { termine: true } }),
    prisma.methodo.count({ where: { NOT: { type: 'structure_peda' } } }),
    prisma.score.findMany({
      where: { source: 'correction' },
      orderBy: { createdAt: 'asc' },
      select: { score: true, createdAt: true, userId: true, courseId: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.user.count(),
    prisma.course.count({ where: { status: 'ready' } }),
  ])

  const tauxReussite = totalExercices > 0 ? Math.round((exercicesTermines / totalExercices) * 100) : 0
  const moyenneNotes = correctionScores.length > 0
    ? Math.round((correctionScores.reduce((s, c) => s + c.score, 0) / correctionScores.length) * 10) / 10
    : null

  // Progression : regrouper les notes par userId+courseId pour voir l'évolution
  const progressionMap = new Map<string, number[]>()
  for (const s of correctionScores) {
    if (!s.userId) continue
    const key = `${s.userId}__${s.courseId}`
    if (!progressionMap.has(key)) progressionMap.set(key, [])
    progressionMap.get(key)!.push(s.score)
  }
  const progressions = Array.from(progressionMap.values()).filter(arr => arr.length >= 2)
  const etudiantsEnProgression = progressions.filter(arr => arr[arr.length - 1] > arr[0]).length
  const etudiantsEnRegression = progressions.filter(arr => arr[arr.length - 1] < arr[0]).length

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold">KPI Pédagogiques</h1>
        <div className="flex gap-3">
          <a href="/admin/signalements" className="text-sm text-gray-400 hover:text-white transition">Signalements</a>
          <a href="/admin/suggestions" className="text-sm text-gray-400 hover:text-white transition">Suggestions</a>
        </div>
      </div>

      {/* Vue globale */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Utilisateurs', value: totalUsers, sub: `+${newUsers7j} cette semaine`, color: 'text-indigo-400' },
          { label: 'Cours traités', value: coursesReady, sub: 'status ready', color: 'text-blue-400' },
          { label: 'Fiches méthodo', value: totalMethodos, sub: 'générées au total', color: 'text-purple-400' },
          { label: 'Signalements', value: totalSignalements, sub: 'erreurs remontées', color: totalSignalements > 10 ? 'text-red-400' : 'text-green-400' },
        ].map((k, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-600 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {/* Réussite exercices guidés */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-gray-200 mb-4">⚖️ Réussite exercices guidés</h2>
          <div className="flex items-end gap-4 mb-3">
            <p className={`text-4xl font-extrabold ${tauxReussite >= 60 ? 'text-green-400' : tauxReussite >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {tauxReussite}%
            </p>
            <p className="text-sm text-gray-500 mb-1">{exercicesTermines}/{totalExercices} exercices terminés</p>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className={`h-2 rounded-full ${tauxReussite >= 60 ? 'bg-green-500' : tauxReussite >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${tauxReussite}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-2">Mesure la compréhension — étudiant va jusqu&apos;au bout du syllogisme</p>
        </div>

        {/* Évolution notes correction */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-gray-200 mb-4">📈 Évolution des notes (correction copie)</h2>
          {correctionScores.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune correction enregistrée pour l&apos;instant.</p>
          ) : (
            <>
              <p className="text-4xl font-extrabold text-indigo-400 mb-1">{moyenneNotes}<span className="text-lg text-gray-500">/20</span></p>
              <p className="text-xs text-gray-500 mb-3">Moyenne sur {correctionScores.length} correction(s)</p>
              {progressions.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-4">
                    <span className="text-sm text-green-400">▲ {etudiantsEnProgression} en progression</span>
                    <span className="text-sm text-red-400">▼ {etudiantsEnRegression} en régression</span>
                  </div>
                  <p className="text-xs text-gray-600">Parmi {progressions.length} étudiants avec 2+ corrections</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {/* Signalements par type */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-gray-200 mb-4">🚨 Fiabilité — Signalements par type</h2>
          {signalementsParType.length === 0 ? (
            <p className="text-green-400 text-sm">Aucun signalement — bonne fiabilité !</p>
          ) : (
            <div className="space-y-2">
              {signalementsParType.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    s.probleme === 'article_invente' ? 'bg-red-900/50 text-red-400' :
                    s.probleme === 'erreur_juridique' ? 'bg-orange-900/50 text-orange-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{s.probleme}</span>
                  <span className="text-sm font-bold text-gray-300">{s._count}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-600 mt-3">Objectif : taux de signalement qui diminue sur le temps</p>
        </div>

        {/* Engagement méthodo */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-gray-200 mb-4">📋 Engagement — Fiches méthodo</h2>
          <p className="text-4xl font-extrabold text-purple-400 mb-1">{totalMethodos}</p>
          <p className="text-xs text-gray-500 mb-3">fiches générées (cas pratique + commentaire + dissertation)</p>
          <p className="text-xs text-gray-600">Mesure si les étudiants reviennent utiliser les outils pédagogiques</p>
        </div>
      </div>

      {/* Légende */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-bold text-gray-200 mb-3 text-sm">📊 Interprétation des KPI</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-500">
          <p>• <strong className="text-gray-400">Taux de signalements faible</strong> → l&apos;IA est fiable</p>
          <p>• <strong className="text-gray-400">Réussite exercices &gt; 60%</strong> → bonne compréhension</p>
          <p>• <strong className="text-gray-400">Notes en hausse</strong> → l&apos;étudiant progresse réellement</p>
          <p>• <strong className="text-gray-400">Méthodo réutilisée</strong> → engagement pédagogique</p>
        </div>
      </div>
    </div>
  )
}
