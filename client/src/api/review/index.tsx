import { apiFetch } from "../apiFetch";
import type Vocabulary from "@/interface/features/Vocabulary";
import type Grammar from "@/interface/features/Grammar";
import type Calligraphy from "@/interface/features/Calligraphy";
import type Exercise from "@/interface/features/Exercise";

/** Extra help for a card that keeps slipping (computed by the server from the user's history). */
export type Leech = {
  lapses: number;
  correct_in_row?: number;      // answers right in a row; the card leaves the leech list at `STUDY.leech.leaveCorrectInRow`
  parts: { character: string; phonetic?: string | null; meaning?: string | null }[];
  confusable: { word: string; translation: string } | null;
};

export type ReviewCard = (Vocabulary | Grammar | Calligraphy | Exercise) & {
  lesson_title?: string; spare?: boolean; est_seconds?: number; section?: "voc" | "gram" | "ex" | "call" | null; leech?: Leech; note?: string | null;
};

/** Saves the user's own memory trick on a card (empty clears it). */
export async function saveCardNote(elementId: string, note: string): Promise<void> {
  await apiFetch(`/api/review/note/${elementId}`, { method: "PUT", body: { note }, errorMessage: "Failed to save the note" });
}

export async function getReviewCards(languageId: string): Promise<ReviewCard[]> {
  return apiFetch(`/api/review/${languageId}`, { errorMessage: `Failed to fetch review cards for language ${languageId}` });
}

/** The daily review queue was finished: validates today for the streak (once per day). */
export async function completeReview(languageId: string, cards: number): Promise<{ streak: number; validated: boolean }> {
  return apiFetch(`/api/review/${languageId}/complete`, { method: "POST", body: { cards }, errorMessage: "Failed to complete the review" });
}
