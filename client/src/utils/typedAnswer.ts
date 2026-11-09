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

// TODO(user): stand-ins, mirroring TYPED_FULL / TYPED_FLOOR in the server's study_constants. At or above FULL a near miss earns the full hit; below FLOOR nothing.
export const TYPED_FULL = 0.9;
export const TYPED_FLOOR = 0.4;

/** The score a typed answer that is not an exact match earns from its character closeness (0..1): full hit near-perfect, linear to 0 at the floor. */
export function gradeFromCloseness(closeness: number, ms: number): number {
    if (closeness >= TYPED_FULL) return gradeForTyped(true, ms);
    if (closeness <= TYPED_FLOOR) return 0;
    return (0.75 * (closeness - TYPED_FLOOR)) / (TYPED_FULL - TYPED_FLOOR);
}
