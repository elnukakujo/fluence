import { apiFetch } from "../apiFetch";

export type GoalKind = "vocabulary" | "grammar" | "calligraphy";
/** Quantities are per period; the saved ones start with the NEXT period, the running period's menu is locked. */
export interface StudyGoal { id: string; language_id: string; period: "week" | "biweek" | "month"; start_date: string; n_vocabulary: number; n_grammar: number; n_calligraphy: number; r_vocabulary: number; r_grammar: number; r_calligraphy: number; active: boolean; auto: boolean }
export interface GoalTypeProgress { n: number; picked: number; mastered: number; carried: number; r: number; review_picked: number; review_done: number; partial?: number; review_partial?: number; carried_partial?: number }
export interface GoalItem { id: string; kind: GoalKind; role: "new" | "review"; label: string; lesson_id: string | null; done: boolean; carried: boolean; progress?: number | null; to_go?: number | null; score?: number; level?: string }
export interface StudyGoalProgress {
    period: string; active: boolean; cycle_start: string; cycle_end: string;
    types: Record<GoalKind, GoalTypeProgress>; items: GoalItem[];
    rebuild?: { mastered: number; redraw: number };
    next: { start: string; period: string; pending: boolean; n: Record<GoalKind, number>; r: Record<GoalKind, number> };
}
export interface Suggested { n: Record<GoalKind, number>; r: Record<GoalKind, number> }
/** `suggested`: the quantities that fit the user's new per week and reviews per day (what an `auto` goal follows). */
/** `targets`: per period, what the new and the review quantities must add up to (the pace numbers scaled to the period). */
export interface StudyGoalState { goal: StudyGoal | null; progress: StudyGoalProgress | null; suggested?: Suggested; targets?: Record<StudyGoal["period"], { n: number; r: number }>; kinds?: GoalKind[] }

export async function getStudyGoal(languageId: string): Promise<StudyGoalState> {
    return apiFetch(`/api/study-goal/${languageId}`, { errorMessage: "Failed to fetch the study goal" });
}

export async function saveStudyGoal(languageId: string, goal: Pick<StudyGoal, "period" | "n_vocabulary" | "n_grammar" | "n_calligraphy" | "r_vocabulary" | "r_grammar" | "r_calligraphy" | "active" | "auto">): Promise<StudyGoalState> {
    return apiFetch(`/api/study-goal/${languageId}`, { method: "PUT", body: goal, errorMessage: "Failed to save the study goal" });
}

/** Rebuild the running menu from the saved quantities; mastered / reviewed elements are kept unless `keepMastered` is false. */
export async function resetStudyGoal(languageId: string, keepMastered = true): Promise<StudyGoalState> {
    return apiFetch(`/api/study-goal/${languageId}/reset`, { method: "POST", body: { keep_mastered: keepMastered }, errorMessage: "Failed to reset the study goal" });
}
