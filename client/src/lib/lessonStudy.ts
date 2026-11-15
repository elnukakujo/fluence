import type Vocabulary from "@/interface/features/Vocabulary";

const shuffled = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

/** Lesson study asks every word on both sides: all fronts, then all backs, each shuffled.
 *  Each item carries the `card_id` the review queue uses ("<id>#<side>"), so a word's two sides stay two distinct cards in the session. */
export function frontsThenBacks(vocabularies: Vocabulary[], shuffle: <T>(xs: T[]) => T[] = shuffled): Vocabulary[] {
    const side = (s: "front" | "back") => shuffle(vocabularies).map((v) => ({ ...v, side: s, card_id: `${v.id}#${s}` }));
    return [...side("front"), ...side("back")];
}
