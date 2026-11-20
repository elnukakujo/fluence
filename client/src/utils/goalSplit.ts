import { STUDY } from "@/shared/studyConstants";
import type { GoalKind } from "@/api/studyGoal";

export const PERIOD_DAYS = { week: 7, biweek: 14, month: 30 } as const;
export type Period = keyof typeof PERIOD_DAYS;

/** A preset's per-week numbers for the chosen period, split over the course's types by the shared share (the server's `default_goal_quantities`):
 *  each type gets at least 1 unless the total is 0, halves round up. */
export function presetQuantities(newPerWeek: number, reviews: number, period: Period, kinds: GoalKind[]) {
    const share = STUDY.goalShare as unknown as Record<string, number>;
    const parts = kinds.reduce((t, k) => t + share[k], 0);
    const split = (perWeek: number) => {
        const whole = Math.round((perWeek * PERIOD_DAYS[period]) / 7);
        return Object.fromEntries(kinds.map((k) => [k, whole ? Math.max(1, Math.floor((whole * share[k]) / parts + 0.5)) : 0])) as Record<GoalKind, number>;
    };
    return { n: split(newPerWeek), r: split(reviews) };
}

/** A preset's number shown for the chosen period. */
export const scaled = (perWeek: number, period: Period) => Math.round((perWeek * PERIOD_DAYS[period]) / 7);
