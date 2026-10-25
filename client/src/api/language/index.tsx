import { BASE_URL, getAuthHeaders } from "..";
import Language from "@/interface/containers/Language";
import Lesson from "@/interface/containers/Lesson";

export async function getAvailableLanguages(userId: string) {
  const res = await fetch(`${BASE_URL}/api/languages/all/${userId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch available languages');
  return res.json();
}

export async function getLanguageById(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/languages/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch language ${languageId}`);
  return res.json();
}

export async function getLanguageData(languageId: string) {
  const language: Language = await getLanguageById(languageId);
  const lessons = await fetch(`${BASE_URL}/api/lessons/all/${languageId}`, { headers: await getAuthHeaders() });
  if (!lessons.ok) throw new Error(`Failed to fetch lessons for language ${languageId}`);
  const lessonsData: Lesson[] = await lessons.json();
  return {
    language,
    lessons: lessonsData,
  };
}

export async function createLanguage(data: Partial<Language>) {
  if (data.id) {
    data.id = undefined;
  }
  const res = await fetch(`${BASE_URL}/api/languages/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create language");
  return res.json();
}

export async function updateLanguage(languageId: string, data: Partial<Language>) {
  const res = await fetch(`${BASE_URL}/api/languages/${languageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update language");
  return res.json();
}

export async function deleteLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/languages/${languageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete language");
}