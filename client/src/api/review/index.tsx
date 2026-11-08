import { BASE_URL, getAuthHeaders } from "..";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";

/** Extra help for a card that keeps slipping (computed by the server from the user's history). */
export type Leech = {
  lapses: number;
  parts: { character: string; phonetic?: string | null; meaning?: string | null }[];
  confusable: { word: string; translation: string } | null;
};

export type ReviewCard = (Vocabulary | Grammar | Calligraphy | Exercise) & {
  lesson_title?: string; spare?: boolean; est_seconds?: number; section?: "voc" | "gram" | "ex" | "call" | null; leech?: Leech; note?: string | null;
};

/** Saves the user's own memory trick on a card (empty clears it). */
export async function saveCardNote(elementId: string, note: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/review/note/${elementId}`, { method: "PUT", headers: await getAuthHeaders(), body: JSON.stringify({ note }) });
  if (!res.ok) throw new Error(`Failed to save the note (${res.status})`);
}

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
