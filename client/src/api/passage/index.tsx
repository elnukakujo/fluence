import { apiFetch } from "../apiFetch";

export async function getPassageById(passageId: string) {
  return apiFetch(`/api/passage/${passageId}`, { errorMessage: `Failed to fetch passage ${passageId}` });
}
