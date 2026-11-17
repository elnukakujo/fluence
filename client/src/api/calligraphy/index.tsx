import Calligraphy from "@/interface/features/Calligraphy";
import { apiFetch } from "../apiFetch";

export async function getCalligraphyById(calligraphyId: string) {
  return apiFetch(`/api/calligraphy/${calligraphyId}`, { errorMessage: `Failed to fetch calligraphy ${calligraphyId}` });
}

export async function getCalligraphyByLanguage(languageId: string) {
  return apiFetch(`/api/calligraphy/language/${languageId}`, { errorMessage: `Failed to fetch calligraphy for language ${languageId}` });
}

export async function getCalligraphyByLesson(lessonId: string) {
  return apiFetch(`/api/calligraphy/lesson/${lessonId}`, { errorMessage: `Failed to fetch calligraphy for lesson ${lessonId}` });
}

export async function createCalligraphy(
  data: Partial<Calligraphy>,
  onConflict?: "keep" | "overwrite" | "merge"
) {
  if (data.id !== undefined) {
    delete data.id;
  }
  return apiFetch("/api/calligraphy/", { method: "POST", body: { ...data, on_conflict: onConflict }, errorMessage: "Failed to create calligraphy", conflict: true });
}

export async function updateCalligraphy(calligraphyId: string, data: Partial<Calligraphy>) {
  return apiFetch(`/api/calligraphy/${calligraphyId}`, { method: "PUT", body: data, errorMessage: "Failed to update calligraphy" });
}

export async function deleteCalligraphy(calligraphyId: string) {
  await apiFetch(`/api/calligraphy/${calligraphyId}`, { method: "DELETE", errorMessage: "Failed to delete calligraphy" });
}

export async function submitCalligraphyDrawing(
  calligraphyId: string,
  similarity: number,
  strokeOrderErrors: number,
  durationMs: number,
  hintUsed = false,
) {
  return apiFetch("/api/calligraphy/draw", {
    method: "POST",
    body: {
      calligraphy_id: calligraphyId,
      similarity,
      stroke_order_errors: strokeOrderErrors,
      duration_ms: durationMs,
      hint_used: hintUsed,
    },
    errorMessage: "Failed to submit calligraphy drawing",
  });
}