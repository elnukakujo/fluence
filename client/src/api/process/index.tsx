import { apiFetch } from "../apiFetch";

// ============= Evaluation API =============
export async function evaluateText(exerciseId: string, userText: string) {
  return apiFetch("/api/evaluate/text", { method: "POST", body: { exercise_id: exerciseId, user_text: userText }, errorMessage: "Failed to evaluate text" });
}

/** Character closeness (0..1) of a typed answer to the expected text, and the indices of `expected` that differ. */
export async function scoreTypedAnswer(text: string, expected: string, languageId?: string): Promise<{ closeness: number; diff: number[] }> {
  return apiFetch("/api/evaluate/typed-answer", { method: "POST", body: { text, expected, language_id: languageId }, errorMessage: "Failed to score typed answer" });
}

export async function evaluateSpeech(exerciseId: string, user_audio_url: string, correct_audio_index: number = 0) {
  return apiFetch("/api/evaluate/speech", { method: "POST", body: { exercise_id: exerciseId, user_audio_url: user_audio_url, correct_audio_index: correct_audio_index }, errorMessage: "Failed to evaluate speech" });
}

// ============= Scoring API =============
export async function updateScoreById(
  elementId: string,
  score: number,
  duration_ms: number,
  hint_used: boolean = false,
  attempt_number?: number,
  side?: "front" | "back",
) {
  let endpoint = "";
  let payload: Record<string, string | number | boolean> = {};

  if (elementId.startsWith("voc_")) {
    endpoint = "/api/vocabulary/score";
    payload = { vocabulary_id: elementId, score, duration_ms, hint_used, ...(side ? { side } : {}) };
  } else if (elementId.startsWith("gram_")) {
    endpoint = "/api/grammar/score";
    payload = { grammar_id: elementId, score, duration_ms, hint_used };
  } else if (elementId.startsWith("call_")) {
    endpoint = "/api/calligraphy/score";
    payload = { calligraphy_id: elementId, score, duration_ms, hint_used };
  } else if (elementId.startsWith("ex_")) {
    endpoint = "/api/exercise/score";
    payload = { exercise_id: elementId, score, duration_ms, hint_used, ...(attempt_number !== undefined ? { attempt_number } : {}) };
  } else {
    throw new Error(`Unsupported element ID for scoring: ${elementId}`);
  }

  return apiFetch(endpoint, { method: "POST", body: payload, errorMessage: "Failed to update score" });
}

// ============= Media API =============
async function upload(kind: "image" | "audio", file: File, temporary: boolean) {
  const formData = new FormData();
  formData.append("file", file);
  if (temporary) {
    formData.append("temporary", "true");
  }
  try {
    return await apiFetch(`/media/upload/${kind}`, { method: "POST", body: formData, errorMessage: `Failed to upload ${kind}` });
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

export const uploadImage = (file: File, temporary = false) => upload("image", file, temporary);
export const uploadAudio = (file: File, temporary = false) => upload("audio", file, temporary);
