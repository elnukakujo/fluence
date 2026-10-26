import Vocabulary from "@/interface/features/Vocabulary";
import { BASE_URL, getAuthHeaders } from "..";
import { throwIfConflict } from "../conflictError";

export async function getVocabularyById(vocabularyId: string) {
  const res = await fetch(`${BASE_URL}/api/vocabulary/${vocabularyId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch vocabulary ${vocabularyId}`);
  return res.json();
}

export async function getVocabularyByLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/vocabulary/language/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch vocabulary for language ${languageId}`);
  return res.json();
}

export async function getVocabularyByLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/vocabulary/lesson/${lessonId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch vocabulary for lesson ${lessonId}`);
  return res.json();
}

export async function createVocabulary(
  data: Partial<Vocabulary>,
  onConflict?: "keep" | "overwrite" | "merge"
) {
  if (data.id) {
    data.id = undefined;
  }
  const res = await fetch(`${BASE_URL}/api/vocabulary/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ ...data, on_conflict: onConflict }),
  });
  await throwIfConflict(res);
  if (!res.ok) throw new Error("Failed to create vocabulary");
  return res.json();
}

export async function updateVocabulary(vocabularyId: string, data: Partial<Vocabulary>) {
  const res = await fetch(`${BASE_URL}/api/vocabulary/${vocabularyId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update vocabulary");
  return res.json();
}

export async function deleteVocabulary(vocabularyId: string) {
  const res = await fetch(`${BASE_URL}/api/vocabulary/${vocabularyId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete vocabulary");
}