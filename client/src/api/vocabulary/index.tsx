import Vocabulary from "@/interface/features/Vocabulary";
import { apiFetch } from "../apiFetch";

export async function getVocabularyById(vocabularyId: string) {
  return apiFetch(`/api/vocabulary/${vocabularyId}`, { errorMessage: `Failed to fetch vocabulary ${vocabularyId}` });
}

export async function getVocabularyByLanguage(languageId: string) {
  return apiFetch(`/api/vocabulary/language/${languageId}`, { errorMessage: `Failed to fetch vocabulary for language ${languageId}` });
}

export async function getVocabularyByLesson(lessonId: string) {
  return apiFetch(`/api/vocabulary/lesson/${lessonId}`, { errorMessage: `Failed to fetch vocabulary for lesson ${lessonId}` });
}

export async function createVocabulary(
  data: Partial<Vocabulary>,
  onConflict?: "keep" | "overwrite" | "merge"
) {
  if (data.id) {
    data.id = undefined;
  }
  return apiFetch("/api/vocabulary/", { method: "POST", body: { ...data, on_conflict: onConflict }, errorMessage: "Failed to create vocabulary", conflict: true });
}

export async function updateVocabulary(vocabularyId: string, data: Partial<Vocabulary>) {
  return apiFetch(`/api/vocabulary/${vocabularyId}`, { method: "PUT", body: data, errorMessage: "Failed to update vocabulary" });
}

export async function deleteVocabulary(vocabularyId: string) {
  await apiFetch(`/api/vocabulary/${vocabularyId}`, { method: "DELETE", errorMessage: "Failed to delete vocabulary" });
}