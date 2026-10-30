"""Can this user import into this language/lesson? One server-side answer for the button, tooltip and upload."""
from typing import Optional

from ...core.auth import can_write
from ...utils.detect_language import get_language_by_iso2t
from ...utils.llm_providers import resolve_api
from ..containers import LanguageService
from ..system_data import UserPreferencesService

NO_TEXT_ENDPOINT = ("no_text_endpoint",
                    "Add and activate a text-generation endpoint (for example DeepSeek) in Settings - "
                    "it is used to extract the vocabulary.")
NO_WRITE_ACCESS = ("no_write_access", "You don't have edit access to this language or lesson.")
NO_VISION_ENDPOINT = ("no_vision_endpoint",
                      "No vision endpoint is set up. Printed documents work without one; handwritten or "
                      "low-quality scans read best with a vision model (Settings).")
CUSTOM_LANGUAGE = ("custom_language",
                   "This language has no standard code, so OCR uses a general model and results may need "
                   "more checking.")


def _item(pair: tuple[str, str]) -> dict:
    return {"code": pair[0], "message": pair[1]}


def has_text_endpoint(prefs) -> bool:
    return bool(prefs and resolve_api(prefs, "text_gen"))


def capabilities(user_id: str, language_id: str, lesson_id: Optional[str] = None) -> dict:
    """`reasons` block the import; `warnings` only inform. The language must exist (checked by the caller)."""
    reasons, warnings = [], []
    if not can_write(user_id, language_id) or (lesson_id and not can_write(user_id, lesson_id)):
        reasons.append(_item(NO_WRITE_ACCESS))
    prefs = UserPreferencesService().get_by_user_id(user_id)
    if not has_text_endpoint(prefs):
        reasons.append(_item(NO_TEXT_ENDPOINT))
    if not (prefs and resolve_api(prefs, "ocr")):
        warnings.append(_item(NO_VISION_ENDPOINT))
    language = LanguageService().get_by_id(language_id, as_dict=True, include_relations=False)
    if language and get_language_by_iso2t(language.get("target_iso639_2t") or "").iso1 == "unknown":
        warnings.append(_item(CUSTOM_LANGUAGE))
    return {"can_import": not reasons, "reasons": reasons, "warnings": warnings}
