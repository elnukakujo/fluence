import Grammar from "@/interface/features/Grammar";
import { BASE_URL, getAuthHeaders } from "..";

export async function getGrammarById(grammarId: string) {
  const res = await fetch(`${BASE_URL}/api/grammar/${grammarId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch grammar ${grammarId}`);
  return res.json();
}

export async function getGrammarByLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/grammar/language/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch grammar for language ${languageId}`);
  return res.json();
}

export async function getGrammarByLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/grammar/lesson/${lessonId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch grammar for lesson ${lessonId}`);
  return res.json();
}

export async function createGrammar(data: Partial<Grammar>) {
  if (data.id) {
    data.id = undefined;
  }
  const res = await fetch(`${BASE_URL}/api/grammar/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create grammar");
  return res.json();
}

export async function updateGrammar(grammarId: string, data: Partial<Grammar>) {
  const res = await fetch(`${BASE_URL}/api/grammar/${grammarId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update grammar");
  return res.json();
}

export async function deleteGrammar(grammarId: string) {
  const res = await fetch(`${BASE_URL}/api/grammar/${grammarId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete grammar");
}