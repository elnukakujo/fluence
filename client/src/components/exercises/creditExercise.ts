import type Exercise from "@/interface/features/Exercise";
import { scoreExercise, overrideExercise, type ScoreSummary } from "@/api/process";
import { exerciseResults } from "@/utils/skills";
import { HINT_CAPS } from "@/utils/cardHints";

type Posted = Parameters<typeof overrideExercise>[1];
let last: { id: string; body: Posted } | null = null;   // the attempt just posted: what "I was right" re-credits

const hints = new Map<string, number>();   // hint steps taken on each exercise before its attempt is posted (RC-25)
export const hintsTaken = (id: string) => hints.get(id) ?? 0;
export const takeHint = (id: string) => { hints.set(id, hintsTaken(id) + 1); return hintsTaken(id); };

/** What the last posted attempt of each exercise did to its elements (the strip in the bar under the card); the bar re-renders when it arrives. */
export type CreditSummary = { before: number; after: number; level: string; levelUp: boolean };
const summaries = new Map<string, CreditSummary>();
const listeners = new Set<() => void>();
const publish = (id: string, s?: ScoreSummary | null) => {
    if (s) summaries.set(id, { before: s.before, after: s.after, level: s.level, levelUp: s.level_up });
    else summaries.delete(id);
    listeners.forEach((l) => l());
};
export const subscribeSummary = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const summaryOf = (id: string): CreditSummary | null => summaries.get(id) ?? null;

/** Post the finished attempt of an exercise: each linked element is credited from the blank / pair that tests it (`parts`), else at `quality`. */
export function creditExercise(ex: Exercise, quality: number, durationMs: number, hintUsed: boolean, attempt: number, parts?: number[]) {
    const taken = hintsTaken(ex.id!);
    hints.delete(ex.id!);
    const cap = HINT_CAPS[Math.min(taken, HINT_CAPS.length - 1)];          // each hint lowers the best credit, like the best grade of a card
    const results = exerciseResults(ex, quality, parts).map((r) => ({ ...r, quality: Math.min(r.quality, cap) }));
    hintUsed = hintUsed || taken > 0;
    last = { id: ex.id!, body: { attemptId: crypto.randomUUID(), results, attempt, durationMs, hintUsed } };
    publish(ex.id!, null);       // a new attempt: the old strip goes
    return scoreExercise(ex.id!, { results, attempt, final: true, durationMs, hintUsed }).then((r) => { publish(ex.id!, r?.summary); return r; }).catch(console.error);
}

/** True while the last posted attempt of this exercise had a wrong part the learner can still dispute. */
export const canOverride = (id: string) => last?.id === id && last.body.results.some((r) => r.quality < 1);

/** A given-up or skipped attempt is not disputable. */
export const forgetAttempt = () => { last = null; hints.clear(); summaries.clear(); listeners.forEach((l) => l()); };

/** "I was right": credit the last attempt at full quality (the server does it once per attempt). */
export function overrideAttempt(id: string) {
    const a = last;
    if (!a || a.id !== id) return Promise.resolve();
    last = null;
    return overrideExercise(id, a.body).then((r) => { if (r?.summary) publish(id, r.summary); return r; }).catch(console.error);
}

/** How the last attempt of this exercise went (for the grammar sheet, RC-22); null when none was posted (given up or skipped). */
export const lastAttempt = (id: string) => (last?.id === id ? { failed: last.body.results.some((r) => r.quality < 1), hintUsed: !!last.body.hintUsed } : null);
