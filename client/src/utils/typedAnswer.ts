import { FAST_MS } from "./cardHints";

const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
const plain = (s: string) => squash(s).normalize("NFD").replace(/[\p{M}\d]/gu, "");   // no tone marks, no tone digits

/** Did the learner type the word (or its phonetic, ignoring tone marks and digits)? Case, spaces and punctuation, full-width included, do not matter. */
export function matchesAnswer(input: string, word: { word?: string; phonetic?: string }): boolean {
    const typed = squash(input);
    if (!typed) return false;
    return typed === squash(word.word ?? "") || (!!word.phonetic && plain(input) !== "" && plain(input) === plain(word.phonetic));
}

/** The score a typed answer earns before any hint cap: wrong 0, right 0.75, right and quick 1. */
export function gradeForTyped(correct: boolean, ms: number): number {
    return !correct ? 0 : ms < FAST_MS ? 1 : 0.75;
}
