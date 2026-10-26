import { BASE_URL, getAuthHeaders } from "..";
import Tag from "@/interface/systemData/Tag";

export async function getAllUserTags(userId: string) {
  const res = await fetch(`${BASE_URL}/api/tags/user/${userId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch user tags");
  return res.json();
}

export async function getTagById(tagId: string) {
  const res = await fetch(`${BASE_URL}/api/tags/${tagId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch tag ${tagId}`);
  return res.json();
}

export async function createTag(data: Partial<Tag>) {
  const res = await fetch(`${BASE_URL}/api/tags/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create tag");
  return res.json();
}

export async function updateTag(tagId: string, data: Partial<Tag>) {
  const res = await fetch(`${BASE_URL}/api/tags/${tagId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update tag");
  return res.json();
}

export async function deleteTag(tagId: string) {
  const res = await fetch(`${BASE_URL}/api/tags/${tagId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete tag");
}

export async function addTagToElement(tagId: string, elementId: string) {
  if (!tagId) throw new Error("addTagToElement: missing tagId");
  if (!elementId) throw new Error("addTagToElement: missing elementId - save the item before adding tags");

  const res = await fetch(`${BASE_URL}/api/tags/add_tag`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ tag_id: tagId, element_id: elementId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to add tag ${tagId} to element ${elementId}: ${res.status} ${text}`);
  }
  return res.json();
}

export async function removeTagFromElement(tagId: string, elementId: string) {
  if (!tagId) throw new Error("removeTagFromElement: missing tagId");
  if (!elementId) throw new Error("removeTagFromElement: missing elementId");

  const res = await fetch(`${BASE_URL}/api/tags/remove_tag`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ tag_id: tagId, element_id: elementId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to remove tag ${tagId} from element ${elementId}: ${res.status} ${text}`);
  }
  return res.json();
}