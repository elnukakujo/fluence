import type Exercise from "@/interface/features/Exercise";
import { scoreExercise, overrideExercise } from "@/api/process";
import { exerciseResults } from "@/utils/skills";

type Posted = Parameters<typeof overrideExercise>[1];
let last: { id: string; body: Posted } | null = null;   // the attempt just posted: what "I was right" re-credits

/** Post the finished attempt of an exercise: each linked element is credited from the blank / pair that tests it (`parts`), else at `quality`. */
export function creditExercise(ex: Exercise, quality: number, durationMs: number, hintUsed: boolean, attempt: number, parts?: number[]) {
    const results = exerciseResults(ex, quality, parts);
    last = { id: ex.id!, body: { attemptId: crypto.randomUUID(), results, attempt, durationMs, hintUsed } };
    return scoreExercise(ex.id!, { results, attempt, final: true, durationMs, hintUsed }).catch(console.error);
}

/** True while the last posted attempt of this exercise had a wrong part the learner can still dispute. */
export const canOverride = (id: string) => last?.id === id && last.body.results.some((r) => r.quality < 1);

/** A given-up or skipped attempt is not disputable. */
export const forgetAttempt = () => { last = null; };

/** "I was right": credit the last attempt at full quality (the server does it once per attempt). */
export function overrideAttempt(id: string) {
    const a = last;
    if (!a || a.id !== id) return Promise.resolve();
    last = null;
    return overrideExercise(id, a.body).catch(console.error);
}
