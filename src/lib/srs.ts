// SRS Algorithm (SuperMemo-2) adapted for Anki-like behavior
export type SRSGrade = 0 | 1 | 2 | 3; // 0: Again, 1: Hard, 2: Good, 3: Easy

export interface SRSCard {
  ease_factor: number;
  interval: number;
  repetition: number;
  next_review: Date;
}

export function calculateNextReview(
  card: SRSCard,
  grade: SRSGrade
): SRSCard {
  let { ease_factor, interval, repetition } = card;

  // Logic inspired by Anki / SM-2
  if (grade >= 1) { // Correct (Hard, Good, Easy)
    if (repetition === 0) {
      // First time seen
      // Easy: 4d, Good: 1d, Hard: 0 (will trigger 6m review)
      interval = grade === 3 ? 4 : grade === 2 ? 1 : 0;
    } else if (repetition === 1) {
      // Second time
      interval = 6;
    } else {
      // Multiplier logic
      const multiplier = grade === 1 ? 1.2 : grade === 2 ? ease_factor : ease_factor * 1.3;
      interval = Math.round(interval * multiplier);
    }
    repetition += 1;
  } else { // Incorrect (Again)
    repetition = 0;
    interval = 0; // Revoir aujourd'hui (ou +10 min)
  }

  // Adjust ease factor (SM-2)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // q mapped from 0-3 to 2-5
  const q = grade + 2; 
  ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  
  if (ease_factor < 1.3) ease_factor = 1.3;

  const next_review = new Date();
  
  // If interval is 0, we set review to 1 minute from now
  if (interval === 0) {
    const minutes = grade === 0 ? 1 : 6; // Again: 1m, Hard: 6m (Anki standard for step 1)
    next_review.setMinutes(next_review.getMinutes() + minutes);
  } else {
    next_review.setDate(next_review.getDate() + interval);
  }

  return {
    ease_factor,
    interval,
    repetition,
    next_review
  };
}

export function getIntervalPreview(card: SRSCard, grade: SRSGrade): string {
  if (grade === 0) return '< 1m';
  if (grade === 1 && card.repetition === 0) return '6m';
  if (card.repetition === 0) {
    if (grade === 2) return '1j';
    if (grade === 3) return '4j';
  }
  
  const next = calculateNextReview(card, grade);
  return `${next.interval}j`;
}
