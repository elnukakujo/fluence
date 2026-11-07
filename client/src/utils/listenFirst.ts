import type { Tier } from "./cardTier";

export const LISTEN_EVERY = 3;     // TODO(user): one eligible card in this many is listened to before it is seen

// FNV-1a: a small, well-spread string hash (the same card gets the same answer all day)
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const dayOf = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

type Card = { id?: string; card_id?: string; side?: string; word?: { audio_files?: string[] } };

/** Is this the day to hear a practising-tier vocabulary front card before seeing it? Needs a stored clip; stable per card and day. */
export function isListenFirst(card: Card, tier: Tier, date: Date): boolean {
    if (tier !== "practising" || card.side !== "front" || !card.word?.audio_files?.length) return false;
    return hash(`${card.card_id ?? card.id}|${dayOf(date)}`) % LISTEN_EVERY === 0;
}
