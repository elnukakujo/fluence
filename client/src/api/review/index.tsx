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
  kind?: string; lesson_title?: string; spare?: boolean; est_seconds?: number; section?: "voc" | "gram" | "ex" | "call" | null; leech?: Leech; note?: string | null;
};

/** Saves the user's own memory trick on a card (empty clears it). */
export async function saveCardNote(elementId: string, note: string): Promise<void> {
  await apiFetch(`/api/review/note/${elementId}`, { method: "PUT", body: { note }, errorMessage: "Failed to save the note" });
}

/** What a review queue is drawn from (server `Scope`): the daily goal, or everything in a lesson / tag / source / type, or exactly the given ids. */
export type ScopeParams =
  | { scope: "daily" }
  | { scope: "lesson"; lesson_id: string }
  | { scope: "tag"; tag_id: string }
  | { scope: "source"; source_id: string }
  | { scope: "type"; type: string }
  | { scope: "free"; ids: string[] };

function scopeQuery(p: ScopeParams): URLSearchParams {
  const q = new URLSearchParams({ scope: p.scope });
  if (p.scope === "lesson") q.set("lesson_id", p.lesson_id);
  if (p.scope === "tag") q.set("tag_id", p.tag_id);
  if (p.scope === "source") q.set("source_id", p.source_id);
  if (p.scope === "type") { q.set("type", p.type); }
  if (p.scope === "free") q.set("ids", p.ids.join(","));
  return q;
}

/** The queue of one entry point; every entry point gets the same item shape and mounts the same `ReviewSession`. */
export async function getQueue(languageId: string, params: ScopeParams): Promise<ReviewCard[]> {
  return apiFetch(`/api/review/${languageId}/queue?${scopeQuery(params)}`, { errorMessage: `Failed to fetch the ${params.scope} queue for language ${languageId}` });
}

/** The lesson's cards of one kind (the lesson study pages show one type at a time), in the server's order. */
export async function getLessonCards(languageId: string, lessonId: string, kind: "vocabulary" | "grammar" | "calligraphy"): Promise<ReviewCard[]> {
  return (await getQueue(languageId, { scope: "lesson", lesson_id: lessonId })).filter((c) => c.kind === kind);
}

/** The page that runs a queue (`/languages/<id>/review/queue?...`): what entry-point buttons link to. */
export function queueHref(languageId: string, params: ScopeParams): string {
  return `/languages/${languageId}/review/queue?${scopeQuery(params)}`;
}

/** The daily review queue was finished: validates today for the streak (once per day). */
export async function completeReview(languageId: string, cards: number): Promise<{ streak: number; validated: boolean; just_validated: boolean }> {
  return apiFetch(`/api/review/${languageId}/complete`, { method: "POST", body: { cards }, errorMessage: "Failed to complete the review" });
}

