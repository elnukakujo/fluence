import { BASE_URL, getAuthHeaders } from "..";
import DailyStats from "@/interface/dataCollection/DailyStats";

export async function getTodayDailyStats(userId: string, languageId: string): Promise<DailyStats | null> {
  const params = new URLSearchParams({
    user_id: userId,
    language_id: languageId,
  });
  const res = await fetch(`${BASE_URL}/api/daily-stats/me/today?${params.toString()}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch today's daily stats");
  return res.json();
}

export async function getDailyStatsHistory(userId: string, languageId?: string, startDate?: string, endDate?: string): Promise<DailyStats[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (languageId) params.set("language_id", languageId);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const res = await fetch(`${BASE_URL}/api/daily-stats/me/history?${params.toString()}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch daily stats history");
  return res.json();
}

export async function getDailyStatsById(dailyStatsId: string, userId: string): Promise<DailyStats> {
  const params = new URLSearchParams({ user_id: userId });
  const res = await fetch(`${BASE_URL}/api/daily-stats/${dailyStatsId}?${params.toString()}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch daily stats ${dailyStatsId}`);
  return res.json();
}