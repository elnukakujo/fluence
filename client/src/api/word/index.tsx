import { apiFetch } from "../apiFetch";

export async function getWordById(wordId: string) {
  return apiFetch(`/api/word/${wordId}`, { errorMessage: `Failed to fetch word ${wordId}` });
}
