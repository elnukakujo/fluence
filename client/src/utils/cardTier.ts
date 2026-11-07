/** How well a flashcard is known, from the card's own score (0-100) and difficulty (0-1). The thresholds are TODO(user) stand-ins. */
export type Tier = "learning" | "practising" | "maintaining";

export const TIER_LEARNING_SCORE = 20;          // below: learning
export const TIER_LEARNING_DIFFICULTY = 0.7;    // above: learning
export const TIER_MAINTAINING_SCORE = 60;       // at or above (and not difficult): maintaining; matches GOAL_MASTERED_SCORE on the server

export function cardTier(score: number, difficulty: number): Tier {
    if (score < TIER_LEARNING_SCORE || difficulty > TIER_LEARNING_DIFFICULTY) return "learning";
    return score >= TIER_MAINTAINING_SCORE ? "maintaining" : "practising";
}

type TierSource = { side?: "front" | "back"; score?: number; difficulty?: number; front_score?: number; front_difficulty?: number; back_score?: number; back_difficulty?: number };

/** The tier of a review card: a vocabulary card by its side's score and difficulty, any other by the element's. No score yet = learning. */
export function tierOf(card: TierSource): Tier {
    const side = card.side;
    const score = (side ? card[`${side}_score`] : undefined) ?? card.score ?? 0;
    const difficulty = (side ? card[`${side}_difficulty`] : undefined) ?? card.difficulty ?? 0.5;
    return cardTier(score, difficulty);
}

/** What the front of a card gives away: its detail (phonetic / strokes) and an example sentence. Peek = hidden behind a button that counts as a hint. */
export function scaffoldsFor(tier: Tier): { detail: "shown" | "hidden"; example: boolean } {
    return tier === "learning" ? { detail: "shown", example: true } : { detail: "hidden", example: false };
}
