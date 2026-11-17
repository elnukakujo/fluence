"""One answer to "may this learner use this AI feature?" (OA-1/2/9, DM-44).

A feature is enabled only for an endpoint of the right purpose that is configured, active, switched on and whose last
test passed for its *current* configuration. Grading, scoring and review never call this: they work with no AI at all.
Reason texts are stand-ins (TODO(owner): wording, spec 4 "Needs the owner" item 5); the client maps `needs` to its own copy.
"""
import hashlib
from dataclasses import dataclass
from typing import Optional

from ..core.database import db_manager
from ..models.system_data import UserPreferences

FEATURES = ("text_gen", "tutor_feedback", "exercise_generation", "import", "ocr_model", "tts")

# feature -> (endpoint purpose, UserPreferences switch that must be on or None, what the feature is called in the reason)
_RULES = {
    "text_gen": ("text_gen", None, "Text generation"),
    "tutor_feedback": ("text_gen", "ai_feedback_enabled", "Tutor feedback"),
    "exercise_generation": ("text_gen", None, "Exercise generation"),
    "import": ("text_gen", None, "Document import"),
    "ocr_model": ("ocr", None, "Model OCR"),
    "tts": ("tts", "ai_tts_enabled", "Audio generation"),
}
_ACCEPTS = {"text_gen": ("text_gen", "both"), "tts": ("tts", "both"), "ocr": ("ocr",)}


@dataclass(frozen=True)
class Capability:
    enabled: bool
    reason: Optional[str] = None
    needs: Optional[str] = None      # "endpoint" | "test" | "switch" | None

    def to_dict(self) -> dict:
        return {"enabled": self.enabled, "reason": self.reason, "needs": self.needs}


def config_hash(endpoint: dict) -> str:
    """Identity of what was tested: URL, model, formats and the key (hashed). Any edit changes it."""
    key_id = hashlib.sha256((endpoint.get("api_key") or "").encode()).hexdigest()[:12]
    parts = [endpoint.get(k) or "" for k in ("base_url", "model", "api_format", "auth_type", "api_type")]
    return hashlib.sha256("|".join([*parts, key_id]).encode()).hexdigest()[:16]


def test_passed(endpoint: dict) -> bool:
    t = endpoint.get("test") or {}
    return bool(t.get("passed")) and t.get("config_hash") == config_hash(endpoint)


def capability_for(prefs, feature: str) -> Capability:
    """`prefs` is a UserPreferences row or None."""
    purpose, switch, label = _RULES[feature]
    if switch and prefs is not None and getattr(prefs, switch) is False:
        return Capability(False, f"{label} is switched off in Settings.", "switch")
    endpoints = [e for e in (getattr(prefs, "ai_endpoints", None) or [])
                 if isinstance(e, dict) and e.get("api_type") in _ACCEPTS[purpose] and e.get("base_url")]
    active = [e for e in endpoints if e.get("is_active")]
    if not active:
        return Capability(False, f"{label} needs an active {purpose.replace('_', ' ')} endpoint. Add one in Settings.", "endpoint")
    if not test_passed(active[0]):          # the endpoint `resolve_api` would use
        return Capability(False, f"{label} needs your {purpose.replace('_', ' ')} endpoint to pass its connection test. Run the test in Settings.", "test")
    return Capability(True)


def capability(user_id: str, feature: str, session=None) -> Capability:
    if feature not in _RULES:
        raise ValueError(f"unknown feature: {feature}")
    prefs = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
    return capability_for(prefs, feature)


def all_capabilities(user_id: str, session=None) -> dict[str, dict]:
    prefs = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
    return {f: capability_for(prefs, f).to_dict() for f in FEATURES}


def gated_api(prefs, purpose: str) -> Optional[dict]:
    """`resolve_api` for the learner's endpoint of `purpose` ("text_gen" | "tts" | "ocr"), or None when the capability
    is off (not configured, not active, switched off, or its test has not passed for the current configuration)."""
    from ..utils.llm_providers import resolve_api
    feature = "ocr_model" if purpose == "ocr" else purpose
    if not prefs or not capability_for(prefs, feature).enabled:
        return None
    return resolve_api(prefs, purpose)
