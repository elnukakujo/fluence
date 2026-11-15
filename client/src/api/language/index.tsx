import { apiFetch } from "../apiFetch";
import Language from "@/interface/containers/Language";
import Lesson from "@/interface/containers/Lesson";

export async function getAvailableLanguages(userId: string) {
  return apiFetch(`/api/languages/all/${userId}`, { errorMessage: "Failed to fetch available languages" });
}

export async function getLanguageById(languageId: string) {
  return apiFetch(`/api/languages/${languageId}`, { errorMessage: `Failed to fetch language ${languageId}` });
}

export async function getLanguageData(languageId: string) {
  const language: Language = await getLanguageById(languageId);
  const lessonsData: Lesson[] = await apiFetch(`/api/lessons/all/${languageId}`, { errorMessage: `Failed to fetch lessons for language ${languageId}` });
  return {
    language,
    lessons: lessonsData,
  };
}

export async function createLanguage(data: Partial<Language>) {
  if (data.id) {
    data.id = undefined;
  }
  return apiFetch("/api/languages/", { method: "POST", body: data, errorMessage: "Failed to create language" });
}

export async function updateLanguage(languageId: string, data: Partial<Language>) {
  return apiFetch(`/api/languages/${languageId}`, { method: "PUT", body: data, errorMessage: "Failed to update language" });
}

export async function deleteLanguage(languageId: string) {
  await apiFetch(`/api/languages/${languageId}`, { method: "DELETE", errorMessage: "Failed to delete language" });
}

/** `ids`: every language the user owns, in the new order. */
export const reorderLanguages = (ids: string[]) => apiFetch("/api/languages/reorder", { method: "POST", body: { ids }, errorMessage: "Failed to reorder languages" });

export const bulkDeleteLanguages = (ids: string[]): Promise<{ deleted: number }> => apiFetch("/api/languages/bulk-delete", { method: "POST", body: { ids }, errorMessage: "Failed to delete languages" });
