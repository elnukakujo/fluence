import { BASE_URL, getAuthHeaders } from "..";
import Calligraphy from "@/interface/features/Calligraphy";
import { throwIfConflict } from "../conflictError";

export async function getCalligraphyById(calligraphyId: string) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/${calligraphyId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch calligraphy ${calligraphyId}`);
  return res.json();
}

export async function getCalligraphyByLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/language/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch calligraphy for language ${languageId}`);
  return res.json();
}

export async function getCalligraphyByLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/lesson/${lessonId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch calligraphy for lesson ${lessonId}`);
  return res.json();
}

export async function createCalligraphy(
  data: Partial<Calligraphy>,
  onConflict?: "keep" | "overwrite" | "merge"
) {
  if (data.id !== undefined) {
    delete data.id;
  }
  const res = await fetch(`${BASE_URL}/api/calligraphy/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ ...data, on_conflict: onConflict }),
  });
  await throwIfConflict(res);
  if (!res.ok) throw new Error("Failed to create calligraphy");
  return res.json();
}

export async function updateCalligraphy(calligraphyId: string, data: Partial<Calligraphy>) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/${calligraphyId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update calligraphy");
  return res.json();
}

export async function deleteCalligraphy(calligraphyId: string) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/${calligraphyId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete calligraphy");
}

export async function submitCalligraphyDrawing(
  calligraphyId: string,
  similarity: number,
  strokeOrderErrors: number,
  durationMs: number,
) {
  const res = await fetch(`${BASE_URL}/api/calligraphy/draw`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      calligraphy_id: calligraphyId,
      similarity,
      stroke_order_errors: strokeOrderErrors,
      duration_ms: durationMs,
    }),
  });
  if (!res.ok) throw new Error("Failed to submit calligraphy drawing");
  return res.json();
}