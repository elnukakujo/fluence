import Grammar from "@/interface/features/Grammar";
import { apiFetch } from "../apiFetch";

export async function getGrammarById(grammarId: string) {
  return apiFetch(`/api/grammar/${grammarId}`, { errorMessage: `Failed to fetch grammar ${grammarId}` });
}

export async function getGrammarByLanguage(languageId: string) {
  return apiFetch(`/api/grammar/language/${languageId}`, { errorMessage: `Failed to fetch grammar for language ${languageId}` });
}

export async function getGrammarByLesson(lessonId: string) {
  return apiFetch(`/api/grammar/lesson/${lessonId}`, { errorMessage: `Failed to fetch grammar for lesson ${lessonId}` });
}

export async function createGrammar(data: Partial<Grammar>) {
  if (data.id) {
    data.id = undefined;
  }
  return apiFetch("/api/grammar/", { method: "POST", body: data, errorMessage: "Failed to create grammar" });
}

export async function updateGrammar(grammarId: string, data: Partial<Grammar>) {
  return apiFetch(`/api/grammar/${grammarId}`, { method: "PUT", body: data, errorMessage: "Failed to update grammar" });
}

export async function deleteGrammar(grammarId: string) {
  await apiFetch(`/api/grammar/${grammarId}`, { method: "DELETE", errorMessage: "Failed to delete grammar" });
}