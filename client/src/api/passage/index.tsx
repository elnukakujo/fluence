import { BASE_URL, getAuthHeaders } from "..";

export async function getPassageById(passageId: string) {
  const res = await fetch(`${BASE_URL}/api/passage/${passageId}`);
  if (!res.ok) throw new Error(`Failed to fetch passage ${passageId}`);
  return res.json();
}
