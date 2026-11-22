import { apiFetch } from "../apiFetch";

/** What one review session came to (ST-9). */
export type SessionStats = { cards: number; correct: number; duration_ms: number; avg_score_gain: number; avg_difficulty_change: number; by_type: Record<string, number> };

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  return apiFetch(`/api/review/session/${sessionId}`, { errorMessage: "Failed to fetch the session summary" });
}
