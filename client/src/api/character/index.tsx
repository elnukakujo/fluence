import { BASE_URL, getAuthHeaders } from "..";

export async function getCharacterById(characterId: string) {
  const res = await fetch(`${BASE_URL}/api/character/${characterId}`);
  if (!res.ok) throw new Error(`Failed to fetch character ${characterId}`);
  return res.json();
}
