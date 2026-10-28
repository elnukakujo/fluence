"""Provider presets for LLM endpoints — base URLs, auth types, API formats.

90% of providers speak OpenAI-compatible. The other 10% (Anthropic, Gemini)
get native translation in model_api.py. This module just holds the catalog.
"""

PROVIDERS: dict[str, dict] = {
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "deepseek": {
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "ollama": {
        "label": "Ollama",
        "base_url": "http://localhost:11434/v1",
        "auth_type": "none",
        "api_format": "openai",
    },
    "kimi": {
        "label": "Kimi (Moonshot)",
        "base_url": "https://api.moonshot.cn/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "groq": {
        "label": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "mistral": {
        "label": "Mistral",
        "base_url": "https://api.mistral.ai/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "openrouter": {
        "label": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "auth_type": "bearer",
        "api_format": "openai",
    },
    "anthropic": {
        "label": "Anthropic (Claude)",
        "base_url": "https://api.anthropic.com/v1",
        "auth_type": "x-api-key",
        "api_format": "anthropic",
    },
    "gemini": {
        "label": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "auth_type": "param",
        "api_format": "gemini",
    },
    "llamacpp": {
        "label": "llama.cpp Server",
        "base_url": "http://localhost:8080/v1",
        "auth_type": "none",
        "api_format": "openai",
    },
    "localai": {
        "label": "LocalAI",
        "base_url": "http://localhost:8080/v1",
        "auth_type": "none",
        "api_format": "openai",
    },
    "elevenlabs": {
        "label": "ElevenLabs",
        "base_url": "https://api.elevenlabs.io/v1",
        "auth_type": "x-api-key",
        "api_format": "elevenlabs",
    },
    "google_tts": {
        "label": "Google Cloud TTS",
        "base_url": "https://texttospeech.googleapis.com/v1",
        "auth_type": "param",
        "api_format": "google_tts",
    },
    "local_tts": {
        "label": "Local TTS (Kokoro / Piper)",
        "base_url": "http://localhost:8880/v1",
        "auth_type": "none",
        "api_format": "openai",
    },
    "custom": {
        "label": "Custom",
        "base_url": "",
        "auth_type": "bearer",
        "api_format": "openai",
    },
}

# List form for the /api/pref/providers endpoint — keeps the frontend in sync
# without duplicating the catalog in client code.
PROVIDER_LIST = [
    {"value": key, "label": v["label"], "base_url": v["base_url"],
     "auth_type": v["auth_type"], "api_format": v["api_format"]}
    for key, v in PROVIDERS.items()
]


def get_provider(key: str) -> dict:
    """Return a copy of the provider preset, or the custom preset for unknowns."""
    return dict(PROVIDERS.get(key, PROVIDERS["custom"]))


def auth_headers(base_url: str, api_key: str, auth_type: str) -> tuple[str, dict]:
    """Return (effective_url, headers_dict) for the auth type.

    - bearer:  Authorization: Bearer {key}
    - x-api-key: x-api-key: {key}
    - param:   appends ?key={key} to the URL
    - none:    no auth
    """
    headers: dict = {}
    url = base_url
    key = (api_key or "").strip()
    if auth_type == "bearer" and key:
        headers["Authorization"] = f"Bearer {key}"
    elif auth_type == "x-api-key" and key:
        headers["x-api-key"] = key
    elif auth_type == "param" and key:
        url = f"{base_url}?key={key}"
    # "none" or empty key → no auth header
    return url, headers


def resolve_api(prefs, api_type: str = "text_gen") -> dict | None:
    """Return {base_url, api_key, model, api_format, auth_type[, voice, voice_gender]}
    from the first active endpoint matching api_type ("text_gen" or "tts"),
    falling back to legacy flat fields if no ai_endpoints match.

    Returns None when no API is configured — callers should skip the LLM call.
    """
    if not prefs:
        return None

    # Check ai_endpoints first
    for ep in getattr(prefs, "ai_endpoints", None) or []:
        if isinstance(ep, dict) and ep.get("is_active") and ep.get("api_type") in (api_type, "both"):
            api = {
                "base_url": ep.get("base_url", "") or "",
                "api_key": ep.get("api_key", "") or "",
                "model": ep.get("model", "") or "",
                "api_format": ep.get("api_format") or "openai",
                "auth_type": ep.get("auth_type") or "bearer",
            }
            if api_type == "tts":
                api["voice"] = ep.get("voice") or ""
                api["voice_gender"] = ep.get("voice_gender") or None
            return api

    # Legacy fallback — kept for backward compatibility with pre-multi-endpoint users
    if api_type == "tts":
        legacy_url = getattr(prefs, "ai_tts_api_base_url", None) or ""
        if legacy_url:
            return {
                "base_url": legacy_url,
                "api_key": getattr(prefs, "ai_tts_api_key", None) or "",
                "model": getattr(prefs, "ai_tts_model", None) or "",
                "voice": "",
                "voice_gender": None,
                "api_format": "openai",
                "auth_type": "bearer",
            }
    else:
        legacy_url = getattr(prefs, "ai_gen_api_base_url", None) or ""
        if legacy_url:
            return {
                "base_url": legacy_url,
                "api_key": getattr(prefs, "ai_gen_api_key", None) or "",
                "model": getattr(prefs, "ai_gen_model", None) or "",
                "api_format": "openai",
                "auth_type": "bearer",
            }

    return None
