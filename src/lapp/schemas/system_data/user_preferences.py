from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, field_validator

VALID_PROVIDERS = {
    "openai", "deepseek", "ollama", "kimi", "groq", "mistral", "mistral_ocr",
    "openrouter", "anthropic", "gemini", "llamacpp", "localai",
    "elevenlabs", "google_tts", "local_tts", "custom",
}
VALID_API_FORMATS = {"openai", "anthropic", "gemini", "elevenlabs", "google_tts", "mistral_ocr"}
VALID_AUTH_TYPES = {"bearer", "x-api-key", "param", "none"}
VALID_API_TYPES = {"text_gen", "tts", "both", "ocr"}  # "both" = text_gen + tts only


def _normalize_base_url(v: Optional[str]) -> Optional[str]:
    """Normalize a user-entered base URL.

    Auto-prepends ``http://`` to bare ``host:port`` values (e.g. ``localhost:11434``)
    so local endpoints save without the user typing the scheme. Anything with a
    scheme already, or a non-http(s) scheme, is rejected as before.
    """
    if not v:
        return v
    v = v.strip()
    if "://" not in v:
        v = "http://" + v
    if not (v.startswith("http://") or v.startswith("https://")):
        raise ValueError("must start with http:// or https://")
    return v.rstrip("/")


class ApiEndpoint(BaseModel):
    """A single LLM API endpoint configuration."""
    name: str = ""
    provider: str = "custom"
    api_type: str = "text_gen"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    is_active: bool = False
    voice: Optional[str] = None
    voice_gender: Optional[str] = None  # "male" | "female" | None
    api_format: str = "openai"
    auth_type: str = "bearer"

    @field_validator("provider")
    @classmethod
    def _check_provider(cls, v: str) -> str:
        if v not in VALID_PROVIDERS:
            raise ValueError(f"Unknown provider: {v}")
        return v

    @field_validator("api_format")
    @classmethod
    def _check_api_format(cls, v: str) -> str:
        if v not in VALID_API_FORMATS:
            raise ValueError(f"Unknown api_format: {v}")
        return v

    @field_validator("auth_type")
    @classmethod
    def _check_auth_type(cls, v: str) -> str:
        if v not in VALID_AUTH_TYPES:
            raise ValueError(f"Unknown auth_type: {v}")
        return v

    @field_validator("api_type")
    @classmethod
    def _check_api_type(cls, v: str) -> str:
        if v not in VALID_API_TYPES:
            raise ValueError(f"Unknown api_type: {v}")
        return v

    @field_validator("base_url")
    @classmethod
    def _validate_base_url(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_base_url(v)


class UserPreferencesDict(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    native_language_iso639_2: Optional[List[str]] = ['eng']
    learning_goals: Optional[str] = ''
    preferred_exercise_types: Optional[List[str]] = []
    daily_goal_minutes: Optional[int] = 20
    last_updated: Optional[datetime] = None
    ai_feedback_enabled: Optional[bool] = True
    ai_learnable_sentence_enabled: Optional[bool] = True
    ai_example_sentence_enabled: Optional[bool] = True
    ai_example_word_enabled: Optional[bool] = True
    ai_tts_enabled: Optional[bool] = True
    ai_gen_api_base_url: Optional[str] = None
    ai_gen_api_key: Optional[str] = None
    ai_gen_model: Optional[str] = None
    ai_tts_api_base_url: Optional[str] = None
    ai_tts_api_key: Optional[str] = None
    ai_tts_model: Optional[str] = None
    ai_endpoints: Optional[list] = None
    user: Optional[dict] = None

    @field_validator("ai_gen_api_base_url", "ai_tts_api_base_url")
    @classmethod
    def _validate_api_base_url(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_base_url(value)

    @field_validator("ai_endpoints")
    @classmethod
    def _validate_endpoints(cls, v: Optional[list]) -> Optional[list]:
        if v is None:
            return None
        validated = []
        for ep in v:
            if not isinstance(ep, dict):
                continue
            validated.append(ApiEndpoint(**ep).model_dump())
        return validated