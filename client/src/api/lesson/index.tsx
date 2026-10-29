import { BASE_URL, getAuthHeaders } from "..";
import Lesson from "@/interface/containers/Lesson";

export async function getLessonById(lesson_id: string) {
  const res = await fetch(`${BASE_URL}/api/lessons/${lesson_id}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch data for lesson ${lesson_id}`);
  return res.json();
}

export async function getAllLessons(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/lessons/all/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch lessons for language ${languageId}`);
  return res.json();
}

export async function createLesson(data: Partial<Lesson>) {
  if (data.id) {
    data.id = undefined;
  }
  const res = await fetch(`${BASE_URL}/api/lessons/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create lesson");
  return res.json();
}

export async function updateLesson(lessonId: string, data: Partial<Lesson>) {
  const res = await fetch(`${BASE_URL}/api/lessons/${lessonId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update lesson");
  return res.json();
}

export async function deleteLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/lessons/${lessonId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete lesson");
}
export async function getSharedLessons(): Promise<Lesson[]> {
  const res = await fetch(`${BASE_URL}/api/lessons/shared`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch shared lessons");
  return res.json();
}

export async function leaveSharedLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/lessons/${lessonId}/leave`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to stop sharing");
  return res.json();
}
