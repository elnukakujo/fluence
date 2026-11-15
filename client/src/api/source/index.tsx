import { apiFetch } from "../apiFetch";
import Source from "@/interface/systemData/Source";

export async function getAllUserSources(userId: string) {
  return apiFetch(`/api/sources/user/${userId}`, { errorMessage: "Failed to fetch user sources" });
}

export async function getSourceById(sourceId: string) {
  return apiFetch(`/api/sources/${sourceId}`, { errorMessage: `Failed to fetch source ${sourceId}` });
}

export async function createSource(data: Partial<Source>) {
  return apiFetch("/api/sources/", { method: "POST", body: data, errorMessage: "Failed to create source" });
}

export async function updateSource(sourceId: string, data: Partial<Source>) {
  return apiFetch(`/api/sources/${sourceId}`, { method: "PUT", body: data, errorMessage: "Failed to update source" });
}

export async function deleteSource(sourceId: string) {
  await apiFetch(`/api/sources/${sourceId}`, { method: "DELETE", errorMessage: "Failed to delete source" });
}

export async function addSourceToElement(sourceId: string, elementId: string) {
  return apiFetch("/api/sources/add_source", { method: "POST", body: { source_id: sourceId, element_id: elementId }, errorMessage: `Failed to add source ${sourceId} to element ${elementId}` });
}

export async function removeSourceFromElement(sourceId: string, elementId: string) {
  return apiFetch("/api/sources/remove_source", { method: "POST", body: { source_id: sourceId, element_id: elementId }, errorMessage: `Failed to remove source ${sourceId} from element ${elementId}` });
}
export async function mergeSources(data: { keep_id: string; merge_id: string; title?: string; date?: string; source_type?: string; description?: string }): Promise<Source> {
  return apiFetch("/api/sources/merge", { method: "POST", body: data, errorMessage: "Failed to merge the sources" });
}

export async function bulkDeleteSources(ids: string[]): Promise<{ deleted: number }> {
  return apiFetch("/api/sources/bulk-delete", { method: "POST", body: { ids }, errorMessage: "Failed to delete" });
}

/** `ids`: every source the user owns, in the new order. */
export async function reorderSources(ids: string[]): Promise<void> {
  await apiFetch("/api/sources/reorder", { method: "POST", body: { ids }, errorMessage: "Failed to reorder" });
}
