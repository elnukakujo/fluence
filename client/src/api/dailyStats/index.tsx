import { apiFetch } from "../apiFetch";
import DailyStats from "@/interface/dataCollection/DailyStats";
import HomeStats, { LanguageSummary } from "@/interface/dataCollection/HomeStats";

export async function getTodayDailyStats(userId: string, languageId: string): Promise<DailyStats | null> {
  const params = new URLSearchParams({
    user_id: userId,
    language_id: languageId,
  });
  return apiFetch(`/api/daily-stats/me/today?${params.toString()}`, {
    errorMessage: "Failed to fetch today's daily stats",
  });
}

export async function getDailyStatsHistory(userId: string, languageId?: string, startDate?: string, endDate?: string): Promise<DailyStats[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (languageId) params.set("language_id", languageId);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  return apiFetch(`/api/daily-stats/me/history?${params.toString()}`, {
    errorMessage: "Failed to fetch daily stats history",
  });
}

export async function getDailyStatsById(dailyStatsId: string, userId: string): Promise<DailyStats> {
  const params = new URLSearchParams({ user_id: userId });
  return apiFetch(`/api/daily-stats/${dailyStatsId}?${params.toString()}`, {
    errorMessage: `Failed to fetch daily stats ${dailyStatsId}`,
  });
}

export async function getHomeStats(): Promise<HomeStats> {
  return apiFetch("/api/stats/home", { errorMessage: "Failed to fetch the home stats", cache: "no-store" });
}

/** One language's headline numbers (the entry `getHomeStats` lists for it); 404 when it is not the caller's. */
export async function getLanguageSummary(languageId: string): Promise<LanguageSummary> {
  return apiFetch(`/api/stats/${languageId}/summary`, { errorMessage: "Failed to fetch the language summary", cache: "no-store" });
}

/** What the custom review's Type tab shows for one studied type. `due` = cards of it in today's daily review; exercises have no seen/score/fading. */
export type TypeStat = { total: number; seen: number | null; mean_seen: number | null; fading: number | null; due: number };
export type TypeStats = Record<string, TypeStat>;

export async function getTypeStats(languageId: string): Promise<TypeStats> {
  return apiFetch(`/api/stats/${languageId}/types`, { errorMessage: "Failed to fetch the type stats", cache: "no-store" });
}
