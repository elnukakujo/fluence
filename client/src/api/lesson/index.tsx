import { apiFetch } from "../apiFetch";
import Lesson from "@/interface/containers/Lesson";

export async function getLessonById(lesson_id: string) {
  return apiFetch(`/api/lessons/${lesson_id}`, { errorMessage: `Failed to fetch data for lesson ${lesson_id}` });
}

export async function getAllLessons(languageId: string) {
  return apiFetch(`/api/lessons/all/${languageId}`, { errorMessage: `Failed to fetch lessons for language ${languageId}` });
}

export async function createLesson(data: Partial<Lesson>) {
  if (data.id) {
    data.id = undefined;
  }
  return apiFetch("/api/lessons/", { method: "POST", body: data, errorMessage: "Failed to create lesson" });
}

export async function updateLesson(lessonId: string, data: Partial<Lesson>) {
  return apiFetch(`/api/lessons/${lessonId}`, { method: "PUT", body: data, errorMessage: "Failed to update lesson" });
}

export async function deleteLesson(lessonId: string) {
  await apiFetch(`/api/lessons/${lessonId}`, { method: "DELETE", errorMessage: "Failed to delete lesson" });
}
export async function getSharedLessons(): Promise<Lesson[]> {
  return apiFetch("/api/lessons/shared", { errorMessage: "Failed to fetch shared lessons" });
}

export async function leaveSharedLesson(lessonId: string) {
  return apiFetch(`/api/lessons/${lessonId}/leave`, { method: "DELETE", errorMessage: "Failed to stop sharing" });
}

export async function reorderLessons(languageId: string, ids: string[]) {
  await apiFetch("/api/lessons/reorder", { method: "POST", body: { language_id: languageId, ids }, errorMessage: "Failed to reorder lessons" });
}

export async function bulkDeleteLessons(ids: string[]): Promise<{ deleted: number }> {
  return apiFetch("/api/lessons/bulk-delete", { method: "POST", body: { ids }, errorMessage: "Failed to delete lessons" });
}

export async function mergeLessons(data: { first_id: string; second_id: string; title: string; description?: string; level?: number }): Promise<Lesson> {
  return apiFetch("/api/lessons/merge", { method: "POST", body: data, errorMessage: "Failed to merge the lessons" });
}
