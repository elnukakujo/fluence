import { BASE_URL, getAuthHeaders } from "..";
import UserPreferences from "@/interface/systemData/UserPreferences";

export async function updateUserPreferences(prefId: string, data: Partial<UserPreferences>) {
  const res = await fetch(`${BASE_URL}/api/pref/${prefId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to update user preferences (${res.status})`);
  }
  return res.json();
}
