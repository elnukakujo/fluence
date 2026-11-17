import { STUDY } from "@/shared/studyConstants";

const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
const plain = (s: string) => squash(s).normalize("NFD").replace(/[\p{M}\d]/gu, "");   // no tone marks, no tone digits

/** Did the learner type the word (or its phonetic, ignoring tone marks and digits)? Case, spaces and punctuation, full-width included, do not matter. */
export function matchesAnswer(input: string, word: { word?: string; phonetic?: string }): boolean {
    const typed = squash(input);
    if (!typed) return false;
    return typed === squash(word.word ?? "") || (!!word.phonetic && plain(input) !== "" && plain(input) === plain(word.phonetic));
}

/** The score a typed answer earns before any hint cap: wrong 0, right 1. How long it took never counts (flip time only suggests a grade, `suggestedGrade`). */
export function gradeForTyped(correct: boolean): number {
    return correct ? 1 : 0;
}

// At or above FULL a near miss earns the full hit; below FLOOR nothing.
export const TYPED_FULL = STUDY.typed.full;
export const TYPED_FLOOR = STUDY.typed.floor;

/** The quality one typed blank earns from its closeness to the answer: a near-perfect fill is a full hit, linear to 0 at the floor. */
export function blankQuality(closeness: number): number {
    return closeness >= TYPED_FULL ? 1 : closeness <= TYPED_FLOOR ? 0 : (closeness - TYPED_FLOOR) / (TYPED_FULL - TYPED_FLOOR);
}
