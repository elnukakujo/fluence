import { apiFetch } from "../apiFetch";
import UserPreferences from "@/interface/systemData/UserPreferences";

export async function updateUserPreferences(prefId: string, data: Partial<UserPreferences>) {
  return apiFetch(`/api/pref/${prefId}`, { method: "PUT", body: data, errorMessage: "Failed to update user preferences" });
}
