import { BASE_URL, getAuthHeaders } from "..";

export async function getWordById(wordId: string) {
  const res = await fetch(`${BASE_URL}/api/word/${wordId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch word ${wordId}`);
  return res.json();
}
