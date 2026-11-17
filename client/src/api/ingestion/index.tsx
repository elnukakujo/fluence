import { apiFetch } from "../apiFetch";
import { BASE_URL } from "..";
import type { AcceptElement, AcceptItem, Candidate } from "@/lib/ingestion/review";

export type SourceMetadata = {
  source_title?: string;
  source_type?: string;
  source_description?: string;
  level?: number;
};

export type Notice = { code: string; message: string };
export type Capabilities = { can_import: boolean; reasons: Notice[]; warnings: Notice[]; can_generate_audio?: boolean };

export type JobStatus = "queued" | "parsing" | "pages" | "structure" | "extracting" | "ready" | "failed";
export type Job = {
  id: string;
  language_id: string;
  lesson_id: string | null;
  filename: string;
  source_title?: string | null;
  handwritten: boolean;
  page_ranges: [number, number][] | null;
  status: JobStatus;
  paused?: boolean; // the user paused it; the reader waits before its next page
  finished?: boolean; // everything wanted from a ready import has been added
  pages_done: number;
  pages_total: number;
  error: string | null;
  warnings: string[];
  created_at: string | null;
  page_kinds?: Record<string, string[]> | null;
};

export type LessonProgress = {
  index: number; title: string; start_page: number; end_page: number; ranges?: [number, number][]; verified: boolean | null; note: string | null;
  status: "pending" | "done" | "failed"; error: string | null;
  counts: { total: number; verified: number; flagged: number } | null;
  created_lesson_id: string | null;
  candidates?: Candidate[];
  elements?: Parameters<typeof flattenElements>[0];
};

export type Structure = {
  status: JobStatus; confirmed: boolean; first_page: number; last_page: number; lessons: LessonProgress[]; warnings: string[]; page_kinds?: Record<string, string[]> | null;
};

export const ACTIVE_STATUSES: JobStatus[] = ["queued", "parsing", "pages", "extracting"];

/** Tells the navbar's Imports button to refresh right away (it otherwise polls slowly while nothing is running). */
export const INGESTION_CHANGED = "ingestion:changed";
const notifyChanged = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(INGESTION_CHANGED)); };

export async function getCapabilities(languageId: string, lessonId?: string): Promise<Capabilities> {
  const q = new URLSearchParams({ language_id: languageId, ...(lessonId ? { lesson_id: lessonId } : {}) });
  return apiFetch(`/api/ingestion/capabilities?${q}`, { errorMessage: "Could not check whether you can import" });
}

export async function uploadDocument(form: FormData): Promise<{ job_id: string }> {
  const result = await apiFetch(`/api/ingestion`, { method: "POST", body: form, errorMessage: "Upload failed" });
  notifyChanged();
  return result;
}

export async function getJob(jobId: string): Promise<Job> {
  return apiFetch(`/api/ingestion/${jobId}`, { errorMessage: "Could not load this import" });
}

export async function listJobs(): Promise<Job[]> {
  return apiFetch(`/api/ingestion`, { errorMessage: "Could not load your imports" });
}

type StoredElement = { kind: Candidate["kind"]; fields: Record<string, unknown> } & Omit<Candidate, "kind">;

/** The server keeps element data under `fields`; the review rows read it flat, like a vocabulary candidate. */
export function flattenElements(elements: StoredElement[] = []): Candidate[] {
  return elements.map((e) => ({ ...e.fields, ...e }) as unknown as Candidate);
}

export async function getCandidates(jobId: string): Promise<{ candidates: Candidate[]; warnings: string[] }> {
  const body = await apiFetch(`/api/ingestion/${jobId}/candidates`, { errorMessage: "Could not load the results" });
  return { ...body, candidates: [...body.candidates, ...flattenElements(body.elements)] };
}

export type MergedGrammar = { title: string; explanation: string; example_sentences: string[]; corrections?: { from: string; to: string }[] };

export type ExerciseItem = { exercise_type?: string; question?: string; answer?: string; text_support?: string | null; content?: Record<string, unknown> | null; chunk_id?: string };
/** A rebuilt exercise: the card's fields plus the checks the server ran on it. */
export type RebuiltExercise = {
  exercise_type: string; question: string; answer: string; text_support: string | null; content: Record<string, unknown> | null;
  status: "verified" | "flagged"; quote: string; min_conf: number | null; flags: { code: string; message: string; severity: "warning" | "info" }[];
};

async function postExercises(jobId: string, path: string, body: object, failure: string): Promise<RebuiltExercise> {
  return apiFetch(`/api/ingestion/${jobId}/exercises/${path}`, { method: "POST", body, errorMessage: failure });
}

/** Join several exercise cards into one exercise (of `exercise_type`, else the model's pick). */
export const mergeExercises = (jobId: string, items: ExerciseItem[], exercise_type?: string) =>
  postExercises(jobId, "merge", { items, exercise_type }, "Could not merge the exercises");

/** Rebuild one exercise card, as `exercise_type` or the model's pick, following an optional free-text request. */
export const regenerateExercise = (jobId: string, item: ExerciseItem, opts: { exercise_type?: string; request?: string } = {}) =>
  postExercises(jobId, "regenerate", { item, ...opts }, "Could not redo the exercise");

/** The user's text-generation model joins grammar candidates the parser split (no summarising); throws with the server's reason. */
export async function mergeGrammar(jobId: string, items: { title?: string; explanation?: string; original_text?: string }[]): Promise<MergedGrammar> {
  return apiFetch(`/api/ingestion/${jobId}/merge`, { method: "POST", body: { items }, errorMessage: "Could not merge the grammar points" });
}

/** Redo one grammar candidate from its original page text (same model, same rules as the merge). */
export async function regenerateGrammar(jobId: string, item: { title?: string; explanation?: string; original_text?: string }, request?: string): Promise<MergedGrammar> {
  return apiFetch(`/api/ingestion/${jobId}/regenerate`, { method: "POST", body: { items: [item], request }, errorMessage: "Could not redo the grammar point" });
}

export async function acceptCandidates(jobId: string, lessonId: string, items: AcceptItem[], elements?: AcceptElement[]): Promise<{ created: number; created_elements: number; notes?: string[] }> {
  const body: { lesson_id: string; items: AcceptItem[]; elements?: AcceptElement[] } = { lesson_id: lessonId, items };
  if (elements && elements.length > 0) body.elements = elements;
  const result = await apiFetch(`/api/ingestion/${jobId}/accept`, { method: "POST", body, errorMessage: "Could not add the selected items" });
  notifyChanged();
  return result;
}

/** Stop a running import before the next page is read (no more model calls are paid for); it ends as "failed: Stopped by you." */
export async function stopJob(jobId: string): Promise<void> {
  await apiFetch(`/api/ingestion/${jobId}/stop`, { method: "POST", errorMessage: "Could not stop this import" });
  notifyChanged();
}

export async function pauseJob(jobId: string): Promise<void> {
  await apiFetch(`/api/ingestion/${jobId}/pause`, { method: "POST", errorMessage: "Could not pause this import" });
  notifyChanged();
}

export async function resumeJob(jobId: string): Promise<void> {
  await apiFetch(`/api/ingestion/${jobId}/resume`, { method: "POST", errorMessage: "Could not resume this import" });
  notifyChanged();
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch(`/api/ingestion/${jobId}`, { method: "DELETE", errorMessage: "Could not delete this import" });
  notifyChanged();
}

/** Back from the review to the pages / lessons step (the results are discarded). */
export async function stepBack(jobId: string): Promise<void> {
  await apiFetch(`/api/ingestion/${jobId}/back`, { method: "POST", errorMessage: "Could not go back" });
  notifyChanged();
}

/** 1-based document page. Same-origin, so the session cookie authorises the <img>. */
export const pageImageUrl = (jobId: string, page: number) => `${BASE_URL}/api/ingestion/${jobId}/pages/${page}.png`;

export async function getStructure(jobId: string): Promise<Structure> {
  return apiFetch(`/api/ingestion/${jobId}/structure`, { errorMessage: "Could not load the lessons" });
}

export async function confirmStructure(jobId: string, lessons: { title: string; ranges: [number, number][] }[], pageKinds?: Record<string, string[]>) {
  const body: { lessons: { title: string; ranges: [number, number][] }[]; page_kinds?: Record<string, string[]> } = { lessons };
  if (pageKinds) body.page_kinds = pageKinds;
  const result = await apiFetch(`/api/ingestion/${jobId}/structure`, { method: "POST", body, errorMessage: "Could not start the extraction" });
  notifyChanged();
  return result;
}

export async function getPages(jobId: string): Promise<{ status: JobStatus; page_kinds: Record<string, string[]>; first_page: number; last_page: number; warnings: string[] }> {
  return apiFetch(`/api/ingestion/${jobId}/pages`, { errorMessage: "Could not load the pages" });
}

export async function confirmPages(jobId: string, pageKinds: Record<string, string[]>): Promise<{ status: JobStatus }> {
  const result = await apiFetch(`/api/ingestion/${jobId}/pages`, { method: "POST", body: { page_kinds: pageKinds }, errorMessage: "Could not confirm the pages" });
  notifyChanged();
  return result;
}

export async function getLanguageCandidates(jobId: string): Promise<{ status: JobStatus; lessons: LessonProgress[]; warnings: string[] }> {
  return apiFetch(`/api/ingestion/${jobId}/candidates`, { errorMessage: "Could not load the results" });
}

/** Adds one lesson in the background (a big one takes minutes): polls the server and reports n / total until it is done. */
export async function acceptLesson(jobId: string, index: number, items: AcceptItem[], title?: string, elements?: AcceptElement[],
  onProgress?: (done: number, total: number) => void): Promise<{ lesson_id: string; created: number; created_elements: number; notes?: string[] }> {
  const body: { items: AcceptItem[]; title?: string; elements?: AcceptElement[] } = { items };
  if (title) body.title = title;
  if (elements && elements.length > 0) body.elements = elements;
  const url = `/api/ingestion/${jobId}/lessons/${index}/accept`;
  const first = await apiFetch(`${url}?background=1`, { method: "POST", body, errorMessage: "Could not add this lesson" });
  onProgress?.(first.done, first.total);
  for (let misses = 0; ;) {
    await new Promise((r) => setTimeout(r, 700));
    let state;
    try {
      state = await apiFetch(url, { errorMessage: "Could not add this lesson" });
      misses = 0;
    } catch {
      if (++misses > 20) throw new Error("Lost contact with the server - check the lesson list before adding it again");
      continue;
    }
    onProgress?.(state.done, state.total);
    if (state.state === "failed") throw new Error(state.error || "Could not add this lesson");
    if (state.state === "done") { notifyChanged(); return state.result; }
  }
}
