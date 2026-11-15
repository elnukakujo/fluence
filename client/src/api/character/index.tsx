import { apiFetch } from "../apiFetch";

export async function getCharacterById(characterId: string) {
  return apiFetch(`/api/character/${characterId}`, { errorMessage: `Failed to fetch character ${characterId}` });
}
