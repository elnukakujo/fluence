import { apiFetch } from "../apiFetch";

export async function getCharacterById(characterId: string) {
  return apiFetch(`/api/character/${characterId}`, { errorMessage: `Failed to fetch character ${characterId}` });
}

export async function listCharacters(languageId: string, radicals = false) {
  return apiFetch(`/api/character/?language_id=${languageId}${radicals ? "&radicals=1" : ""}`, { errorMessage: "Failed to fetch characters" });
}

export async function copyRadical(characterId: string, catalogueId: number) {
  return apiFetch(`/api/character/${characterId}/radical`, { method: "POST", body: { catalogue_id: catalogueId }, errorMessage: "Failed to add radical" });
}

export async function listRadicals(languageId: string) {
  return apiFetch(`/api/character/radicals?language_id=${languageId}`, { errorMessage: "Failed to fetch radicals" });
}
