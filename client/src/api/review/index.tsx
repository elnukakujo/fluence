import { BASE_URL, getAuthHeaders } from "..";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";

export type ReviewCard = (Vocabulary | Grammar | Calligraphy | Exercise) & { lesson_title?: string; section?: "voc" | "gram" | "ex" | "call" | null };

export async function getReviewCards(languageId: string): Promise<ReviewCard[]> {
  const res = await fetch(`${BASE_URL}/api/review/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch review cards for language ${languageId}`);
  return res.json();
}

/** The daily review queue was finished: validates today for the streak (once per day). */
export async function completeReview(languageId: string, cards: number): Promise<{ streak: number; validated: boolean }> {
  const res = await fetch(`${BASE_URL}/api/review/${languageId}/complete`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ cards }) });
  if (!res.ok) throw new Error(`Failed to complete the review (${res.status})`);
  return res.json();
}
