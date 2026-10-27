import { BASE_URL, getAuthHeaders } from "..";

export async function fetchLogs(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/logs`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch logs");
  const data = await res.json();
  return data.logs ?? [];
}
