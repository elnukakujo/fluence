import { BASE_URL, getAuthHeaders } from "..";

export type SearchCategory = "container" | "feature" | "component";

export interface SearchResult {
  category: SearchCategory;
  type: string;
  id: string;
  label: string;
  language_id?: string;
  lesson_id?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export async function searchElements(query: string, userId: string, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "X-User-Id": userId,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to search elements");
  }

  return response.json();
}
