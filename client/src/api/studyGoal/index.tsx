import { BASE_URL, getAuthHeaders } from "..";

export interface StudyGoal { id: string; language_id: string; period: "week" | "biweek" | "month"; start_date: string; n_vocabulary: number; n_grammar: number; n_calligraphy: number; active: boolean }
export interface GoalTypeProgress { n: number; picked: number; mastered: number; carried: number }
export interface StudyGoalProgress { period: string; active: boolean; cycle_start: string; cycle_end: string; types: Record<"vocabulary" | "grammar" | "calligraphy", GoalTypeProgress> }
export interface StudyGoalState { goal: StudyGoal | null; progress: StudyGoalProgress | null }

export async function getStudyGoal(languageId: string): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}`, { headers: await getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch the study goal (${res.status})`);
    return res.json();
}

export async function saveStudyGoal(languageId: string, goal: Pick<StudyGoal, "period" | "n_vocabulary" | "n_grammar" | "n_calligraphy" | "active">): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}`, { method: "PUT", headers: await getAuthHeaders(), body: JSON.stringify(goal) });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Failed to save the study goal (${res.status})`);
    return res.json();
}

export async function pickStudyGoalNow(languageId: string): Promise<StudyGoalState> {
    const res = await fetch(`${BASE_URL}/api/study-goal/${languageId}/pick`, { method: "POST", headers: await getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to pick (${res.status})`);
    return res.json();
}
