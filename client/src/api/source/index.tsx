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