import logging
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _hanzi_dict():
    from hanzipy.dictionary import HanziDictionary
    return HanziDictionary()

@lru_cache(maxsize=1)
def _hanzi_decomposer():
    from hanzipy.decomposer import HanziDecomposer
    return HanziDecomposer()

def get_cjk_character_info(character: str, iso1: str) -> dict:
    """
    Return radical and English meaning for a single CJK character.
    Relevant for: zh (Chinese), ja (Japanese kanji).
    Returns empty values for all other languages.
    Args:
        character: A single character string, e.g. "学".
        iso1:      ISO 639-1 language code.
    Returns:
        {
          "radical": str, # e.g. "子" — Kangxi radical; "" if unknown
          "meaning": str, # English gloss (CEDICT first sense); "" if unknown
          "components": list[str], # first-level parts (hanzipy decomposition, e.g. 河 -> ["氵", "可"]); [] if unknown
        }
    Examples:
        get_cjk_character_info("学", "zh")
        # → {"radical": "子", "meaning": "to learn"}
        get_cjk_character_info("水", "ja")
        # → {"radical": "水", "meaning": "water"}
        get_cjk_character_info("A", "en")
        # → {"radical": "", "meaning": ""}
    """
    empty: dict = {"radical": "", "meaning": "", "components": []}
    lang = iso1.split("-")[0].lower()
    if lang not in ("zh", "ja"):
        return empty
    try:
        # --- radical ---
        radical, components = "", []
        try:
            components = [c for c in _hanzi_decomposer().decompose(character, 1).get("components", []) if "glyph" not in c.lower() and c != character]
        except Exception:
            pass
        try:
            decomposition = _hanzi_decomposer().decompose(character)
            radical_list = decomposition.get("radical", [])
            valid = [r for r in radical_list if "glyph" not in r.lower()]
            radical = valid[0] if valid else ""
        except Exception:
            pass

        # --- meaning (from CEDICT via hanzipy) ---
        meaning = ""
        try:
            entries = _hanzi_dict().definition_lookup(character, script_type="simplified")
            if entries:
                defs = entries[0].get("definition", "")
                if defs:
                    meaning = defs.split("/")[0].strip(" /")
        except Exception:
            pass

        return {"radical": radical, "meaning": meaning, "components": components}

    except Exception as exc:
        logger.error("get_cjk_character_info(%r, %s): %s", character, iso1, exc)
        return empty