import { BASE_URL, getAuthHeaders } from "..";
import Exercise from "@/interface/features/Exercise";

export async function getExerciseById(exerciseId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercise ${exerciseId}`);
  return res.json();
}

export async function getExercisesByLanguage(languageId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/language/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercises for language ${languageId}`);
  return res.json();
}

export async function getExercisesByLesson(lessonId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/lesson/${lessonId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch exercises for lesson ${lessonId}`);
  return res.json();
}

export async function createExercise(data: Partial<Exercise>) {
  if (data.id !== undefined) {
    delete data.id;
  }
  const res = await fetch(`${BASE_URL}/api/exercise/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create exercise");
  return res.json();
}

export async function updateExercise(exerciseId: string, data: Partial<Exercise>) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update exercise");
  return res.json();
}

export async function deleteExercise(exerciseId: string) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete exercise");
}
/** Asks the server to generate (with the user's TTS endpoint) and store the clip of one reading / dictation line.
 *  Throws an Error whose message is the server's code: "tts_not_configured" or "tts_failed". */
export async function generateLineAudio(exerciseId: string, line: number): Promise<{ audio_files: string[]; content: Exercise["content"] }> {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}/line-audio`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ line }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "tts_failed");
  return res.json();
}

export async function setExerciseUserPref(exerciseId: string, mode: "boost" | "ban" | null) {
  const res = await fetch(`${BASE_URL}/api/exercise/${exerciseId}/user-pref`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`Failed to set the exercise preference (${res.status})`);
  return res.json();
}

export type GenerationJob = {
  state: "running" | "done" | "failed"; done: number; total: number; error?: string;
  result?: { batch_id: string; saved: number; flagged: string[] };
};

const codeOf = async (res: Response, fallback: string) => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

/** Recommended number of exercises for a lesson and the planned mix of types. */
export async function suggestGeneration(lessonId: string): Promise<{ count: number; mix: Record<string, number>; pool: number; types?: string[] }> {
  const res = await fetch(`${BASE_URL}/api/lesson/${lessonId}/exercises/suggest`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(await codeOf(res, "suggest_failed"));
  return res.json();
}

/** Starts a background generation; returns the job id. Throws an Error whose message is the server's code (text_gen_not_configured, empty_lesson, ...). */
export async function startGeneration(lessonId: string, count: number, mix?: Record<string, number>): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/lesson/${lessonId}/exercises/generate`, {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(mix ? { count, mix } : { count }),
  });
  if (!res.ok) throw new Error(await codeOf(res, "generate_failed"));
  return (await res.json()).job_id;
}

/** Progress of a generation job. Throws Error("lost") when the server no longer knows the job (restart). */
export async function getGeneration(jobId: string): Promise<GenerationJob> {
  const res = await fetch(`${BASE_URL}/api/exercise-generation/${jobId}`, { headers: await getAuthHeaders() });
  if (res.status === 404) throw new Error("lost");
  if (!res.ok) throw new Error(await codeOf(res, "progress_failed"));
  return res.json();
}

/** The lesson's job left running (or just failed) while the user was elsewhere, or null. */
export async function getActiveGeneration(lessonId: string): Promise<(GenerationJob & { job_id: string }) | null> {
  const res = await fetch(`${BASE_URL}/api/lesson/${lessonId}/exercises/generate`, { headers: await getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}

/** Deletes every exercise of one generation batch. */
export async function undoGenerationBatch(batchId: string): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE_URL}/api/exercise-batch/${batchId}`, { method: "DELETE", headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(await codeOf(res, "undo_failed"));
  return res.json();
}
