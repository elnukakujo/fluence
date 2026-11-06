import { BASE_URL, getAuthHeaders } from "..";

export type GoalKind = "vocabulary" | "grammar" | "calligraphy";
/** Quantities are per period; the saved ones start with the NEXT period, the running period's menu is locked. */
export interface StudyGoal { id: string; language_id: string; period: "week" | "biweek" | "month"; start_date: string; n_vocabulary: number; n_grammar: number; n_calligraphy: number; r_vocabulary: number; r_grammar: number; r_calligraphy: number; active: boolean; auto: boolean }
export interface GoalTypeProgress { n: number; picked: number; mastered: number; carried: number; r: number; review_picked: number; review_done: number }
export interface GoalItem { id: string; kind: GoalKind; role: "new" | "review"; label: string; lesson_id: string | null; done: boolean; carried: boolean }
export interface StudyGoalProgress {
    period: string; active: boolean; cycle_start: string; cycle_end: string;
    types: Record<GoalKind, GoalTypeProgress>; items: GoalItem[];
    rebuild?: { mastered: number; redraw: number };
    next: { start: string; period: string; pending: boolean; n: Record<GoalKind, number>; r: Record<GoalKind, number> };
}
export interface Suggested { n: Record<GoalKind, number>; r: Record<GoalKind, number> }
/** `suggested`: the quantities that fit the user's daily minutes (what an `auto` goal follows). */
export interface StudyGoalState { goal: StudyGoal | null; progress: StudyGoalProgress | null; suggested?: Suggested }

export async function getStudyGoal(languageId: string): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}`, { headers: await getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch the study goal (${res.status})`);
    return res.json();
}

export async function saveStudyGoal(languageId: string, goal: Pick<StudyGoal, "period" | "n_vocabulary" | "n_grammar" | "n_calligraphy" | "r_vocabulary" | "r_grammar" | "r_calligraphy" | "active" | "auto">): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}`, { method: "PUT", headers: await getAuthHeaders(), body: JSON.stringify(goal) });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Failed to save the study goal (${res.status})`);
    return res.json();
}

/** Rebuild the running menu from the saved quantities; mastered / reviewed elements are kept unless `keepMastered` is false. */
export async function resetStudyGoal(languageId: string, keepMastered = true): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}/reset`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ keep_mastered: keepMastered }) });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Failed to reset the study goal (${res.status})`);
    return res.json();
}
