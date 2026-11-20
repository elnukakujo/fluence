import type Exercise from "@/interface/features/Exercise";
import { scoreExercise, overrideExercise } from "@/api/process";
import { exerciseResults } from "@/utils/skills";
import { HINT_CAPS } from "@/utils/cardHints";

type Posted = Parameters<typeof overrideExercise>[1];
let last: { id: string; body: Posted } | null = null;   // the attempt just posted: what "I was right" re-credits

const hints = new Map<string, number>();   // hint steps taken on each exercise before its attempt is posted (RC-25)
export const hintsTaken = (id: string) => hints.get(id) ?? 0;
export const takeHint = (id: string) => { hints.set(id, hintsTaken(id) + 1); return hintsTaken(id); };

/** Post the finished attempt of an exercise: each linked element is credited from the blank / pair that tests it (`parts`), else at `quality`. */
export function creditExercise(ex: Exercise, quality: number, durationMs: number, hintUsed: boolean, attempt: number, parts?: number[]) {
    const taken = hintsTaken(ex.id!);
    hints.delete(ex.id!);
    const cap = HINT_CAPS[Math.min(taken, HINT_CAPS.length - 1)];          // each hint lowers the best credit, like the best grade of a card
    const results = exerciseResults(ex, quality, parts).map((r) => ({ ...r, quality: Math.min(r.quality, cap) }));
    hintUsed = hintUsed || taken > 0;
    last = { id: ex.id!, body: { attemptId: crypto.randomUUID(), results, attempt, durationMs, hintUsed } };
    return scoreExercise(ex.id!, { results, attempt, final: true, durationMs, hintUsed }).catch(console.error);
}

/** True while the last posted attempt of this exercise had a wrong part the learner can still dispute. */
export const canOverride = (id: string) => last?.id === id && last.body.results.some((r) => r.quality < 1);

/** A given-up or skipped attempt is not disputable. */
export const forgetAttempt = () => { last = null; hints.clear(); };

/** "I was right": credit the last attempt at full quality (the server does it once per attempt). */
export function overrideAttempt(id: string) {
    const a = last;
    if (!a || a.id !== id) return Promise.resolve();
    last = null;
    return overrideExercise(id, a.body).catch(console.error);
}

/** How the last attempt of this exercise went (for the grammar sheet, RC-22); null when none was posted (given up or skipped). */
export const lastAttempt = (id: string) => (last?.id === id ? { failed: last.body.results.some((r) => r.quality < 1), hintUsed: !!last.body.hintUsed } : null);
