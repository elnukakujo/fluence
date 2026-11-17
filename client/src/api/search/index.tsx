import { apiFetch } from "../apiFetch";

export type SearchCategory = "container" | "feature" | "component" | "label";

export interface SearchResult {
  category: SearchCategory;
  type: string;
  id: string;
  label: string;
  language_id?: string;
  lesson_id?: string;
  radical?: boolean;   // a character used as some character's key radical
}

export interface SearchResponse {
  results: SearchResult[];
}

export async function searchElements(query: string, userId: string, signal?: AbortSignal): Promise<SearchResponse> {
  return apiFetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { "X-User-Id": userId },
    errorMessage: "Failed to search elements",
  });
}
