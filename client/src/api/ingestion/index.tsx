import { BASE_URL, getAuthHeaders } from "..";
import type { AcceptItem, Candidate } from "@/lib/ingestion/review";

export type SourceMetadata = {
  source_title?: string;
  source_type?: string;
  source_description?: string;
  level?: number;
};

export type Notice = { code: string; message: string };
export type Capabilities = { can_import: boolean; reasons: Notice[]; warnings: Notice[] };

export type JobStatus = "queued" | "parsing" | "pages" | "structure" | "extracting" | "ready" | "failed";
export type Job = {
  id: string;
  language_id: string;
  lesson_id: string | null;
  filename: string;
  handwritten: boolean;
  page_from: number | null;
  page_to: number | null;
  status: JobStatus;
  pages_done: number;
  pages_total: number;
  error: string | null;
  warnings: string[];
  created_at: string | null;
  page_kinds?: Record<string, string[]> | null;
};

export type LessonProgress = {
  index: number; title: string; start_page: number; end_page: number; verified: boolean | null; note: string | null;
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

// The server explains itself ({error}); surface that instead of a generic message.
async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error || fallback);
}

export async function getCapabilities(languageId: string, lessonId?: string): Promise<Capabilities> {
  const q = new URLSearchParams({ language_id: languageId, ...(lessonId ? { lesson_id: lessonId } : {}) });
  const res = await fetch(`${BASE_URL}/api/ingestion/capabilities?${q}`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not check whether you can import");
  return res.json();
}

export async function uploadDocument(form: FormData): Promise<{ job_id: string }> {
  // no Content-Type header: the browser must set the multipart boundary itself
  const res = await fetch(`${BASE_URL}/api/ingestion`, { method: "POST", body: form });
  if (!res.ok) return fail(res, "Upload failed");
  return res.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load this import");
  return res.json();
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${BASE_URL}/api/ingestion`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load your imports");
  return res.json();
}

type StoredElement = { kind: Candidate["kind"]; fields: Record<string, unknown> } & Omit<Candidate, "kind">;

/** The server keeps element data under `fields`; the review rows read it flat, like a vocabulary candidate. */
export function flattenElements(elements: StoredElement[] = []): Candidate[] {
  return elements.map((e) => ({ ...e.fields, ...e }) as unknown as Candidate);
}

export async function getCandidates(jobId: string): Promise<{ candidates: Candidate[]; warnings: string[] }> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/candidates`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load the results");
  const body = await res.json();
  return { ...body, candidates: [...body.candidates, ...flattenElements(body.elements)] };
}

export async function acceptCandidates(jobId: string, lessonId: string, items: AcceptItem[], elements?: { kind: string; fields: Record<string, unknown> }[]): Promise<{ created: number; created_elements: number }> {
  const body: { lesson_id: string; items: AcceptItem[]; elements?: { kind: string; fields: Record<string, unknown> }[] } = { lesson_id: lessonId, items };
  if (elements && elements.length > 0) body.elements = elements;
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/accept`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) return fail(res, "Could not add the words");
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}`, { method: "DELETE", headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not delete this import");
}

/** 1-based document page. Same-origin, so the session cookie authorises the <img>. */
export const pageImageUrl = (jobId: string, page: number) => `${BASE_URL}/api/ingestion/${jobId}/pages/${page}.png`;

export async function getStructure(jobId: string): Promise<Structure> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/structure`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load the lessons");
  return res.json();
}

export async function confirmStructure(jobId: string, lessons: { title: string; start_page: number; end_page: number }[], pageKinds?: Record<string, string[]>) {
  const body: { lessons: { title: string; start_page: number; end_page: number }[]; page_kinds?: Record<string, string[]> } = { lessons };
  if (pageKinds) body.page_kinds = pageKinds;
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/structure`, {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) return fail(res, "Could not start the extraction");
  return res.json();
}

export async function getPages(jobId: string): Promise<{ status: JobStatus; page_kinds: Record<string, string[]>; first_page: number; last_page: number; warnings: string[] }> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/pages`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load the pages");
  return res.json();
}

export async function confirmPages(jobId: string, pageKinds: Record<string, string[]>): Promise<{ status: JobStatus }> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/pages`, {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ page_kinds: pageKinds }),
  });
  if (!res.ok) return fail(res, "Could not confirm the pages");
  return res.json();
}

export async function getLanguageCandidates(jobId: string): Promise<{ status: JobStatus; lessons: LessonProgress[]; warnings: string[] }> {
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/candidates`, { headers: await getAuthHeaders() });
  if (!res.ok) return fail(res, "Could not load the results");
  return res.json();
}

export async function acceptLesson(jobId: string, index: number, items: AcceptItem[], title?: string, elements?: { kind: string; fields: Record<string, unknown> }[]): Promise<{ lesson_id: string; created: number; created_elements: number }> {
  const body: { items: AcceptItem[]; title?: string; elements?: { kind: string; fields: Record<string, unknown> }[] } = { items };
  if (title) body.title = title;
  if (elements && elements.length > 0) body.elements = elements;
  const res = await fetch(`${BASE_URL}/api/ingestion/${jobId}/lessons/${index}/accept`, {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) return fail(res, "Could not add this lesson");
  return res.json();
}
