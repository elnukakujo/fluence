import { apiFetch } from "../apiFetch";

export type LevelCrossed = { id: string; label: string; from: string; to: string };

/** What one review session came to (ST-9, RC-27). */
export type SessionStats = {
  cards: number; correct: number; duration_ms: number; avg_score_gain: number; avg_difficulty_change: number; by_type: Record<string, number>;
  levels_crossed: LevelCrossed[]; to_revisit: string[]; hints_used: number; avg_seconds_per_card: number;
  goal_progress: { met: number; total: number; partial: number } | null;
};

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  return apiFetch(`/api/review/session/${sessionId}`, { errorMessage: "Failed to fetch the session summary" });
}
