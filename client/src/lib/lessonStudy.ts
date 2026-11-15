import type Vocabulary from "@/interface/features/Vocabulary";

/** Lesson study asks every word on both sides in natural (lesson) order: all fronts, then all backs (RE-4).
 *  Each item carries the `card_id` the review queue uses ("<id>#<side>"), so a word's two sides stay two distinct cards in the session. */
export function frontsThenBacks(vocabularies: Vocabulary[]): Vocabulary[] {
    const side = (s: "front" | "back") => vocabularies.map((v) => ({ ...v, side: s, card_id: `${v.id}#${s}` }));
    return [...side("front"), ...side("back")];
}
