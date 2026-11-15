import { STUDY } from "@/shared/studyConstants";
import type { Tier } from "./cardTier";
import { dayOf, hash } from "./stableDaily";

export const DRAW_EVERY = STUDY.cadence.drawEvery;

type Card = { id?: string; card_id?: string };

/** Is this the day to draw a calligraphy card (guide fading with its difficulty) instead of flipping it? Not once it is mastered; stable per card and day. */
export function isDrawFirst(card: Card, tier: Tier, date: Date): boolean {
    if (tier === "maintaining") return false;
    return hash(`${card.card_id ?? card.id}|${dayOf(date)}`) % DRAW_EVERY === 0;
}
