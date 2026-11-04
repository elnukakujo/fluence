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
