import { apiFetch, ApiError } from "../apiFetch";

async function post<T>(path: string, body: unknown, fallback: string): Promise<T> {
  try {
    return await apiFetch<T>(`/api/elements/${path}`, { method: "POST", body, errorMessage: fallback });
  } catch (err) {
    // Today's element bulk throws the server's own {error} text as the message (see element.test.ts).
    if (err instanceof ApiError && err.serverMessage) throw new Error(err.serverMessage);
    throw err;
  }
}

export const bulkDeleteElements = (ids: string[]) => post<{ deleted: number }>("bulk-delete", { ids }, "Failed to delete the items");

export const bulkMoveElements = (ids: string[], target_lesson_id: string) =>
  post<{ moved: number; skipped: { id: string; reason: "shared" | "duplicate" }[] }>("bulk-move", { ids, target_lesson_id }, "Failed to move the items");

export const bulkEditTags = (ids: string[], add: string[], remove: string[]) => post<{ updated: number }>("bulk-tags", { ids, add, remove }, "Failed to edit the tags");

export const bulkEditSources = (ids: string[], add: string[], remove: string[]) => post<{ updated: number }>("bulk-sources", { ids, add, remove }, "Failed to edit the sources");
