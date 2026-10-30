import User from "./User";

export default interface UserPreferences {
    id: string;
    user_id: string;
    user?: User; 
    native_language_iso639_2: string[]; // Array of ISO 639-2 language codes
    learning_goals?: string;
    preferred_exercise_types?: string[]; // e.g., ['essay', 'translate']
    daily_goal_minutes?: number;
    last_updated: string; // ISO date string
    ai_feedback_enabled?: boolean;
    ai_learnable_sentence_enabled?: boolean;
    ai_example_sentence_enabled?: boolean;
    ai_example_word_enabled?: boolean;
    ai_tts_enabled?: boolean;
    ai_gen_api_base_url?: string;
    ai_gen_api_key?: string;
    ai_gen_model?: string;
    ai_tts_api_base_url?: string;
    ai_tts_api_key?: string;
    ai_tts_model?: string;
    ai_endpoints?: ApiEndpointConfig[];
}

export interface ApiEndpointConfig {
    name?: string;
    provider?: string;       // provider key: "openai", "ollama", "local_tts", etc.
    api_type?: "text_gen" | "tts" | "both" | "ocr";
    base_url?: string;
    api_key?: string;
    model?: string;
    is_active: boolean;
    voice?: string;          // explicit TTS voice override (e.g. "alloy", "en_f")
    voice_gender?: "male" | "female"; // voice gender preference (Kokoro-style providers)
    api_format?: string;     // "openai" | "anthropic" | "gemini"
    auth_type?: string;      // "bearer" | "x-api-key" | "param" | "none"
}
