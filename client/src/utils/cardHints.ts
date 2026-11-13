import type { RecallGrade } from "@/components/ui/buttons/recallGradeButtons";

/** Best grade (score sent) allowed after 0, 1 or 2 hints. TODO(user) stand-ins. */
export const HINT_CAPS = [1, 0.75, 0.5];
export const FAST_MS = 3000;     // TODO(user): recalled this quickly with no hint = easy
export const SLOW_MS = 10000;    // TODO(user): slower than this = hard

/** The shape of an answer: its first character and one blank per other character (spaces ignored).
 *  Empty for a one-character answer: showing its first character would be the answer itself (猫). */
export function shapeHint(answer: string): string {
    const chars = [...answer.replace(/\s+/g, "")];
    return chars.length > 1 ? [chars[0], ...chars.slice(1).map(() => "_")].join(" ") : "";
}

/** An example sentence as a hint. The answer being the translation, the sentence is shown as written; the answer being the word,
 *  the word is blanked and the sentence's translation shown. null when there is no example. */
export function contextHint(sentence: { text?: string; translation?: string } | undefined, word: string, answerIs: "word" | "translation"): string | null {
    if (!sentence?.text) return null;
    if (answerIs === "translation") return sentence.text;
    const blanked = word ? sentence.text.split(word).join("___") : sentence.text;
    return sentence.translation ? `${blanked} — ${sentence.translation}` : blanked;
}

/** The grade that matches how the card went: hints first, then the time taken to flip. Only a suggestion; the user decides. */
export function suggestedGrade(ms: number, hintLevel: number): RecallGrade {
    if (hintLevel >= 2) return "hard";
    if (hintLevel === 1) return "good";
    return ms < FAST_MS ? "easy" : ms < SLOW_MS ? "good" : "hard";
}
