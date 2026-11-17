"""The supported languages (DM-34/44/50/62): the only languages a course can be created for.

`levels` are copied from the client's proficiency table (`client/src/utils/language_iso639.tsx`).
TODO(owner): confirm the level tables per language; Korean has no Character/radical type and no calligraphy (DM-50).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class SupportedLanguage:
    iso1: str
    iso2: str            # ISO 639-2/T, what `Language.target_iso639_2t` stores
    name: str
    flag: str
    has_characters: bool
    has_calligraphy: bool
    has_phonetics: bool  # a romanisation exists (see utils/phonetics.py)
    levels: tuple[str, ...]

    def to_dict(self) -> dict:
        return {**self.__dict__, "levels": list(self.levels)}


_CEFR = ("A1", "A2", "B1", "B2", "C1", "C2")

SUPPORTED: dict[str, SupportedLanguage] = {l.iso1: l for l in (
    SupportedLanguage("en", "eng", "English", "🇬🇧", True, True, False, _CEFR),
    SupportedLanguage("es", "spa", "Spanish", "🇪🇸", True, True, False, _CEFR),
    SupportedLanguage("fr", "fra", "French", "🇫🇷", True, True, False, _CEFR),
    SupportedLanguage("it", "ita", "Italian", "🇮🇹", True, True, False, _CEFR),
    SupportedLanguage("pt", "por", "Portuguese", "🇵🇹", True, True, False,
                      ("A1 (CIPLE)", "A2 (DEPLE)", "B1 (DIPLE)", "B2 (DUPLE)", "C1 (DAPLE)", "C2 (DUPLE)")),
    SupportedLanguage("de", "deu", "German", "🇩🇪", True, True, False, _CEFR),
    SupportedLanguage("ja", "jpn", "Japanese", "🇯🇵", True, True, True, ("N5", "N4", "N3", "N2", "N1")),
    SupportedLanguage("zh", "zho", "Chinese", "🇨🇳", True, True, True, tuple(f"HSK {i}" for i in range(1, 7))),
    SupportedLanguage("ko", "kor", "Korean", "🇰🇷", False, False, True, tuple(f"Level {i}" for i in range(1, 7))),
)}

_BY_ISO2 = {l.iso2: l for l in SUPPORTED.values()}


def language_for(iso1: str) -> SupportedLanguage:
    """The supported language for an ISO 639-1 code; ValueError when it is not one of the nine."""
    try:
        return SUPPORTED[(iso1 or "").strip().lower()]
    except KeyError:
        raise ValueError(f"unsupported language: {iso1!r}") from None


def language_for_iso2(iso2: str | None) -> SupportedLanguage | None:
    """The supported language for an ISO 639-2/T code (what courses store), or None."""
    return _BY_ISO2.get((iso2 or "").strip().lower())


def match_course(name: str | None, alias: str | None, iso2: str | None) -> SupportedLanguage | None:
    """Migration matching: by `target_iso639_2t`, then by English name or alias (case-insensitive)."""
    if (hit := language_for_iso2(iso2)):
        return hit
    names = {n.strip().lower() for n in (name, alias) if n}
    return next((l for l in SUPPORTED.values() if l.name.lower() in names or l.iso1 in names), None)


def assign_iso1(rows: list[tuple]) -> dict[str, str]:
    """Migration backfill. `rows` = (id, user_id, name, alias, target_iso639_2t) in display order.
    Returns {course id: iso1}; a course matching no supported language, or a second course of one language for the
    same user, gets nothing (it is reported, never merged or deleted)."""
    out: dict[str, str] = {}
    taken: set[tuple[str, str]] = set()
    for id_, user_id, name, alias, iso2 in rows:
        hit = match_course(name, alias, iso2)
        if hit and (user_id, hit.iso1) not in taken:
            taken.add((user_id, hit.iso1))
            out[id_] = hit.iso1
    return out
