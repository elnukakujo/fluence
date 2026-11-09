import type { Tier } from "./cardTier";
import { dayOf, hash } from "./stableDaily";

export const LISTEN_EVERY = 3;     // TODO(user): one eligible card in this many is listened to before it is seen

type Card = { id?: string; card_id?: string; side?: string; word?: { audio_files?: string[] } };

/** Is this the day to hear a practising-tier vocabulary front card before seeing it? Needs a stored clip; stable per card and day. */
export function isListenFirst(card: Card, tier: Tier, date: Date): boolean {
    if (tier !== "practising" || card.side !== "front" || !card.word?.audio_files?.length) return false;
    return hash(`${card.card_id ?? card.id}|${dayOf(date)}`) % LISTEN_EVERY === 0;
}
