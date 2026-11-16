import { apiFetch } from "../apiFetch";
import type { Evidence, Skill } from "@/utils/skills";

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
export type Answer = {
  similarity: number;          // 0..1, the server rejects anything else
  skill: Skill;
  evidence: Evidence;
  durationMs: number;
  hintUsed?: boolean;
  attempt?: number;            // exercises
  side?: "front" | "back";     // vocabulary
};

export async function updateScoreById(elementId: string, a: Answer) {
  const body = {
    similarity: a.similarity, skill: a.skill, evidence_type: a.evidence, duration_ms: a.durationMs, hint_used: a.hintUsed ?? false,
    ...(a.side ? { side: a.side } : {}),
    ...(a.attempt !== undefined ? { attempt_number: a.attempt } : {}),
  };
  const [endpoint, idKey]: [string, string] | [] =
    elementId.startsWith("voc_") ? ["/api/vocabulary/score", "vocabulary_id"] :
    elementId.startsWith("gram_") ? ["/api/grammar/score", "grammar_id"] :
    elementId.startsWith("call_") ? ["/api/calligraphy/score", "calligraphy_id"] :
    elementId.startsWith("ex_") ? ["/api/exercise/score", "exercise_id"] : [];
  if (!endpoint || !idKey) throw new Error(`Unsupported element ID for scoring: ${elementId}`);

  return apiFetch(endpoint, { method: "POST", body: { [idKey]: elementId, ...body }, errorMessage: "Failed to update score" });
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
