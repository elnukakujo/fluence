import { apiFetch } from "../apiFetch";

export async function fetchLogs(): Promise<string[]> {
  const data = await apiFetch(`/api/logs`, { errorMessage: "Failed to fetch logs" });
  return data.logs ?? [];
}
