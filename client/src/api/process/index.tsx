import { BASE_URL, getAuthHeaders } from "..";


// ============= Evaluation API =============
export async function evaluateText(exerciseId: string, userText: string) {
  const res = await fetch(`${BASE_URL}/api/evaluate/text`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ exercise_id: exerciseId, user_text: userText }),
  });
  if (!res.ok) throw new Error("Failed to evaluate text");
  return res.json();
}

export async function evaluateSpeech(exerciseId: string, user_audio_url: string, correct_audio_index: number = 0) {
  const res = await fetch(`${BASE_URL}/api/evaluate/speech`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ exercise_id: exerciseId, user_audio_url: user_audio_url, correct_audio_index: correct_audio_index }),
  });
  if (!res.ok) throw new Error("Failed to evaluate speech");
  return res.json();
}

// ============= Scoring API =============
export async function updateScoreById(
  elementId: string,
  score: number,
  duration_ms: number,
  hint_used: boolean = false,
  attempt_number?: number,
) {
  let endpoint = "";
  let payload: Record<string, string | number | boolean> = {};

  if (elementId.startsWith("voc_")) {
    endpoint = `${BASE_URL}/api/vocabulary/score`;
    payload = { vocabulary_id: elementId, score, duration_ms, hint_used };
  } else if (elementId.startsWith("gram_")) {
    endpoint = `${BASE_URL}/api/grammar/score`;
    payload = { grammar_id: elementId, score, duration_ms, hint_used };
  } else if (elementId.startsWith("call_")) {
    endpoint = `${BASE_URL}/api/calligraphy/score`;
    payload = { calligraphy_id: elementId, score, duration_ms, hint_used };
  } else if (elementId.startsWith("ex_")) {
    endpoint = `${BASE_URL}/api/exercise/score`;
    payload = { exercise_id: elementId, score, duration_ms, hint_used, ...(attempt_number !== undefined ? { attempt_number } : {}) };
  } else {
    throw new Error(`Unsupported element ID for scoring: ${elementId}`);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update score");
  return res.json();
}


// ============= Media API =============
export async function uploadImage(file: File, temporary = false) {
  const formData = new FormData();
  formData.append("file", file);
  if (temporary) {
    formData.append("temporary", "true");
  }

  try {
    const res = await fetch(`${BASE_URL}/media/upload/image`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to upload image");
    }
    return await res.json();
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}
export async function uploadAudio(file: File, temporary = false) {
  const formData = new FormData();
  formData.append("file", file);
  if (temporary) {
    formData.append("temporary", "true");
  }

  try {
    const res = await fetch(`${BASE_URL}/media/upload/audio`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to upload audio");
    }
    return await res.json();
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}