import { BASE_URL, getAuthHeaders } from "..";
import Exercise from "@/interface/features/Exercise";

export async function getExerciseById(exerciseId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercise ${exerciseId}`);
  return res.json();
}

export async function getExercisesByLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/language/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercises for language ${languageId}`);
  return res.json();
}

export async function getExercisesByLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/lesson/${lessonId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercises for lesson ${lessonId}`);
  return res.json();
}

export async function createExercise(data: Partial<Exercise>) {
  if (data.id !== undefined) {
    delete data.id;
  }
  const res = await fetch(`${BASE_URL}/api/exercise/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create exercise");
  return res.json();
}

export async function updateExercise(exerciseId: string, data: Partial<Exercise>) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update exercise");
  return res.json();
}

export async function deleteExercise(exerciseId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete exercise");
}