export const NIVEAU_INSTRUCTIONS: Record<string, string> = {
  L1: `NIVEAU L1 : L'étudiant débute. Explique les termes à leur première apparition, guide pas à pas, valide les bases. Pas de prérequis supposés. Exigence : application directe de la règle.`,
  L2: `NIVEAU L2 : Les bases sont acquises. Exige une qualification juridique correcte et une application rigoureuse. Commence à pointer les exceptions et nuances importantes.`,
  L3: `NIVEAU L3 : Maîtrise des mécanismes fondamentaux. Exige un syllogisme complet, la connaissance des exceptions et une amorce d'esprit critique. Introduis les débats doctrinaux simples.`,
  M1: `NIVEAU M1 : Maîtrise solide. Exige argumentation développée, mobilisation de jurisprudence, comparaison de solutions et analyse critique. Les réponses approximatives sont insuffisantes.`,
  M2: `NIVEAU M2 : Exigence maximale. Attend réflexion personnelle, positionnement doctrinal, prise en compte des évolutions jurisprudentielles, argumentation originale dépassant le syllogisme basique.`,
}

export const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2'] as const
export type Niveau = typeof NIVEAUX[number]

export const AI_WARNING = 'Contenu généré par IA — vérifie toujours auprès de ton cours et de ton chargé de TD.'

export function getNiveauInstruction(niveau: string): string {
  return NIVEAU_INSTRUCTIONS[niveau] || NIVEAU_INSTRUCTIONS['L1']
}
