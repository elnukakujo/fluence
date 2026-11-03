import { BASE_URL, getAuthHeaders } from "..";

async function post<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/elements/${path}`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? fallback);
  return res.json();
}

export const bulkDeleteElements = (ids: string[]) => post<{ deleted: number }>("bulk-delete", { ids }, "Failed to delete the items");

export const bulkMoveElements = (ids: string[], target_lesson_id: string) =>
  post<{ moved: number; skipped: { id: string; reason: "shared" | "duplicate" }[] }>("bulk-move", { ids, target_lesson_id }, "Failed to move the items");

export const bulkEditTags = (ids: string[], add: string[], remove: string[]) => post<{ updated: number }>("bulk-tags", { ids, add, remove }, "Failed to edit the tags");

export const bulkEditSources = (ids: string[], add: string[], remove: string[]) => post<{ updated: number }>("bulk-sources", { ids, add, remove }, "Failed to edit the sources");
