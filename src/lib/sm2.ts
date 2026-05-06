export type SM2Result = {
  easeFactor: number
  interval: number
  repetition: number
  nextReview: Date
}

/**
 * Algorithme SuperMemo 2 (SM-2)
 * quality : 0-5
 *   0-2 = échec (card reset)
 *   3   = passable
 *   4   = bien
 *   5   = parfait
 */
export function sm2(
  quality: number,
  repetition: number,
  easeFactor: number,
  interval: number
): SM2Result {
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (newEF < 1.3) newEF = 1.3

  let newRepetition: number
  let newInterval: number

  if (quality < 3) {
    // Échec : on recommence à 0
    newRepetition = 0
    newInterval = 1
  } else {
    newRepetition = repetition + 1
    if (repetition === 0) newInterval = 1
    else if (repetition === 1) newInterval = 6
    else newInterval = Math.round(interval * newEF)
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + newInterval)
  nextReview.setHours(0, 0, 0, 0)

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetition: newRepetition,
    nextReview,
  }
}
