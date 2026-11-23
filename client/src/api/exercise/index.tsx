import { ApiError, apiFetch } from "../apiFetch";
import Exercise from "@/interface/features/Exercise";

export async function getExerciseById(exerciseId: string) {
  return apiFetch(`/api/exercise/${exerciseId}`, { errorMessage: `Failed to fetch exercise ${exerciseId}` });
}

export async function getExercisesByLanguage(languageId: string) {
  return apiFetch(`/api/exercise/language/${languageId}`, { errorMessage: `Failed to fetch exercises for language ${languageId}` });
}

export async function getExercisesByLesson(lessonId: string) {
  return apiFetch(`/api/exercise/lesson/${lessonId}`, { errorMessage: `Failed to fetch exercises for lesson ${lessonId}` });
}

export async function createExercise(data: Partial<Exercise>) {
  if (data.id !== undefined) {
    delete data.id;
  }
  return apiFetch("/api/exercise/", { method: "POST", body: data, errorMessage: "Failed to create exercise" });
}

export async function updateExercise(exerciseId: string, data: Partial<Exercise>) {
  return apiFetch(`/api/exercise/${exerciseId}`, { method: "PUT", body: data, errorMessage: "Failed to update exercise" });
}

export async function deleteExercise(exerciseId: string) {
  await apiFetch(`/api/exercise/${exerciseId}`, { method: "DELETE", errorMessage: "Failed to delete exercise" });
}
/** Asks the server to generate (with the user's TTS endpoint) and store the clip of one reading / dictation line.
 *  Throws an Error whose message is the server's code: "tts_not_configured" or "tts_failed". */
export async function generateLineAudio(exerciseId: string, line: number): Promise<{ audio_files: string[]; content: Exercise["content"] }> {
  try {
    return await apiFetch(`/api/exercise/${exerciseId}/line-audio`, {
      method: "POST",
      body: { line },
      errorMessage: "tts_failed",
    });
  } catch (error) {
    throw withServerCode(error);
  }
}

export async function setExerciseUserPref(exerciseId: string, mode: "boost" | "ban" | null) {
  return apiFetch(`/api/exercise/${exerciseId}/user-pref`, { method: "PUT", body: { mode }, errorMessage: "Failed to set the exercise preference" });
}

export type GenerationJob = {
  state: "running" | "done" | "failed"; done: number; total: number; error?: string;
  result?: { batch_id: string; saved: number; flagged: string[] };
};

/** The server's {error} code becomes the message (apiFetch keeps its own fixed text in `message`). */
const withServerCode = (error: unknown) => (error instanceof ApiError && error.serverMessage ? new Error(error.serverMessage) : error);

/** Recommended number of exercises for a lesson and the planned mix of types. */
export async function suggestGeneration(lessonId: string): Promise<{ count: number; mix: Record<string, number>; pool: number; types?: string[] }> {
  return apiFetch(`/api/lesson/${lessonId}/exercises/suggest`, { errorMessage: "suggest_failed" });
}

/** Starts a background generation; returns the job id. Throws an Error whose message is the server's code (text_gen_not_configured, empty_lesson, ...). */
export async function startGeneration(lessonId: string, count: number, mix?: Record<string, number>): Promise<string> {
  try {
    const res = await apiFetch(`/api/lesson/${lessonId}/exercises/generate`, {
      method: "POST",
      body: mix ? { count, mix } : { count },
      errorMessage: "generate_failed",
    });
    return res.job_id;
  } catch (error) {
    throw withServerCode(error);
  }
}

/** Progress of a generation job. Throws Error("lost") when the server no longer knows the job (restart). */
export async function getGeneration(jobId: string): Promise<GenerationJob> {
  try {
    return await apiFetch<GenerationJob>(`/api/exercise-generation/${jobId}`, { errorMessage: "progress_failed" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new Error("lost");
    throw error;
  }
}

/** The lesson's job left running (or just failed) while the user was elsewhere, or null. */
export async function getActiveGeneration(lessonId: string): Promise<(GenerationJob & { job_id: string }) | null> {
  try {
    return await apiFetch(`/api/lesson/${lessonId}/exercises/generate`, { errorMessage: "getActiveGeneration_failed" });
  } catch {
    return null;
  }
}

/** Deletes every exercise of one generation batch. */
export async function undoGenerationBatch(batchId: string): Promise<{ deleted: number }> {
  return apiFetch(`/api/exercise-batch/${batchId}`, { method: "DELETE", errorMessage: "undo_failed" });
}

/** What the model rebuilt for a stored exercise (nothing is saved until the review accepts it). */
export type RedoResult = { exercise_type: NonNullable<Exercise["exercise_type"]>; question: string; answer: string; text_support: string | null; content: Exercise["content"] | null;
  links: { related_vocabulary: string[]; related_grammar: string[]; related_calligraphy: string[] }; review_reason: string | null };

export async function redoExercise(exerciseId: string, exerciseType?: string): Promise<RedoResult> {
  return apiFetch(`/api/exercise/${exerciseId}/redo`, { method: "POST", body: { exercise_type: exerciseType }, errorMessage: "Failed to rebuild the exercise" });
}
