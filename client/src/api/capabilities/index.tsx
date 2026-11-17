import { apiFetch } from "@/api/apiFetch";

export type Feature = "text_gen" | "tutor_feedback" | "exercise_generation" | "import" | "ocr_model" | "tts";
export type Capability = { enabled: boolean; reason: string | null; needs: "endpoint" | "test" | "switch" | null };

/** What the learner may use of the optional AI features, each with the reason when it is off. */
export const getCapabilities = (): Promise<Record<Feature, Capability>> =>
    apiFetch("/api/capabilities", { errorMessage: "Could not load the AI features" });
