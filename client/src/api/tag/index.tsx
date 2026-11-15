import { apiFetch } from "../apiFetch";
import Tag from "@/interface/systemData/Tag";

export async function getAllUserTags(userId: string) {
  return apiFetch(`/api/tags/user/${userId}`, { errorMessage: "Failed to fetch user tags" });
}

export async function getTagById(tagId: string) {
  return apiFetch(`/api/tags/${tagId}`, { errorMessage: `Failed to fetch tag ${tagId}` });
}

export async function createTag(data: Partial<Tag>) {
  return apiFetch("/api/tags/", { method: "POST", body: data, errorMessage: "Failed to create tag" });
}

export async function updateTag(tagId: string, data: Partial<Tag>) {
  return apiFetch(`/api/tags/${tagId}`, { method: "PUT", body: data, errorMessage: "Failed to update tag" });
}

export async function deleteTag(tagId: string) {
  await apiFetch(`/api/tags/${tagId}`, { method: "DELETE", errorMessage: "Failed to delete tag" });
}

export async function addTagToElement(tagId: string, elementId: string) {
  if (!tagId) throw new Error("addTagToElement: missing tagId");
  if (!elementId) throw new Error("addTagToElement: missing elementId - save the item before adding tags");

  return apiFetch("/api/tags/add_tag", { method: "POST", body: { tag_id: tagId, element_id: elementId }, errorMessage: `Failed to add tag ${tagId} to element ${elementId}` });
}

export async function removeTagFromElement(tagId: string, elementId: string) {
  if (!tagId) throw new Error("removeTagFromElement: missing tagId");
  if (!elementId) throw new Error("removeTagFromElement: missing elementId");

  return apiFetch("/api/tags/remove_tag", { method: "POST", body: { tag_id: tagId, element_id: elementId }, errorMessage: `Failed to remove tag ${tagId} from element ${elementId}` });
}
export async function mergeTags(data: { keep_id: string; merge_id: string; name?: string; color?: string; description?: string }): Promise<Tag> {
  return apiFetch("/api/tags/merge", { method: "POST", body: data, errorMessage: "Failed to merge the tags" });
}

export async function bulkDeleteTags(ids: string[]): Promise<{ deleted: number }> {
  return apiFetch("/api/tags/bulk-delete", { method: "POST", body: { ids }, errorMessage: "Failed to delete" });
}

/** `ids`: every tag the user owns, in the new order. */
export async function reorderTags(ids: string[]): Promise<void> {
  await apiFetch("/api/tags/reorder", { method: "POST", body: { ids }, errorMessage: "Failed to reorder" });
}
