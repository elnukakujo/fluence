import { BASE_URL, getAuthHeaders } from "@/api";
import Source from "@/interface/systemData/Source";

export async function getAllUserSources(userId: string) {
  const res = await fetch(`${BASE_URL}/api/sources/user/${userId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch user sources");
  return res.json();
}

export async function getSourceById(sourceId: string) {
  const res = await fetch(`${BASE_URL}/api/sources/${sourceId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch source ${sourceId}`);
  return res.json();
}

export async function createSource(data: Partial<Source>) {
  const res = await fetch(`${BASE_URL}/api/sources/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create source");
  return res.json();
}

export async function updateSource(sourceId: string, data: Partial<Source>) {
  const res = await fetch(`${BASE_URL}/api/sources/${sourceId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update source");
  return res.json();
}

export async function deleteSource(sourceId: string) {
  const res = await fetch(`${BASE_URL}/api/sources/${sourceId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete source");
}

export async function addSourceToElement(sourceId: string, elementId: string) {
  const res = await fetch(`${BASE_URL}/api/sources/add_source`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ source_id: sourceId, element_id: elementId }),
  });
  if (!res.ok) throw new Error(`Failed to add source ${sourceId} to element ${elementId}`);
  return res.json();
}

export async function removeSourceFromElement(sourceId: string, elementId: string) {
  const res = await fetch(`${BASE_URL}/api/sources/remove_source`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ source_id: sourceId, element_id: elementId}),
  });
  if (!res.ok) throw new Error(`Failed to remove source ${sourceId} from element ${elementId}`);
  return res.json();
}
export async function mergeSources(data: { keep_id: string; merge_id: string; title?: string; date?: string; source_type?: string; description?: string }): Promise<Source> {
  const res = await fetch(`${BASE_URL}/api/sources/merge`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to merge the sources");
  return res.json();
}

export async function bulkDeleteSources(ids: string[]): Promise<{ deleted: number }> {
  const { getAuthHeaders } = await import("..");
  const res = await fetch(`${BASE_URL}/api/sources/bulk-delete`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ ids }) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to delete");
  return res.json();
}

/** `ids`: every source the user owns, in the new order. */
export async function reorderSources(ids: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/sources/reorder`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ ids }) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to reorder");
}
