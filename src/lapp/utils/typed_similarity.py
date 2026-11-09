"""Character-level closeness of a typed target-language answer to the expected text (0..1), phonetic-aware."""
import unicodedata
from functools import lru_cache

from lapp.services.features.study_constants import PHONETIC_SUB_COST
from lapp.utils.phonetics import get_phonetic


def _chars(text: str) -> list[tuple[str, int]]:
    """(normalised character, index in `text`): NFKC, lowercase, whitespace / punctuation / symbols dropped."""
    return [(c, i) for i, ch in enumerate(text or "") for c in unicodedata.normalize("NFKC", ch).lower() if c.isalnum()]


def normalize(text: str) -> str:
    return "".join(c for c, _ in _chars(text))


@lru_cache(maxsize=4096)
def _sound(char: str, iso1: str) -> str:
    """What a character sounds like, tone marks and digits aside ("" when the language has no transcription)."""
    try:
        reading = get_phonetic(char, iso1) or ""
    except Exception:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", reading) if not unicodedata.combining(c) and not c.isdigit() and not c.isspace())


def _align(user: list[str], expected: list[str], iso1: str | None, phonetic: bool):
    """Edit-distance matrix; a substitution costs PHONETIC_SUB_COST between characters that sound the same, else 1."""
    def sub(a, b):
        if a == b:
            return 0.0
        if phonetic and iso1:
            sa = _sound(a, iso1)
            return PHONETIC_SUB_COST if sa and sa == _sound(b, iso1) else 1.0
        return 1.0
    d = [[0.0] * (len(expected) + 1) for _ in range(len(user) + 1)]
    for i in range(1, len(user) + 1):
        d[i][0] = float(i)
    for j in range(1, len(expected) + 1):
        d[0][j] = float(j)
    for i in range(1, len(user) + 1):
        for j in range(1, len(expected) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub(user[i - 1], expected[j - 1]))
    return d, sub


def closeness(user: str, expected: str, *, iso1: str | None = None, phonetic: bool = True) -> float:
    u, e = normalize(user), normalize(expected)
    if not u and not e:
        return 1.0
    if not u or not e:
        return 0.0
    d, _ = _align(list(u), list(e), iso1, phonetic)
    return max(0.0, min(1.0, 1 - d[-1][-1] / max(len(u), len(e))))


def diff(user: str, expected: str, *, iso1: str | None = None, phonetic: bool = True) -> list[int]:
    """Indices in `expected` (the original string) of the characters the user got wrong or missed."""
    u, e = [c for c, _ in _chars(user)], _chars(expected)
    ec = [c for c, _ in e]
    d, sub = _align(u, ec, iso1, phonetic)
    i, j, bad = len(u), len(ec), []
    while j > 0:
        if i > 0 and d[i][j] == d[i - 1][j - 1] + sub(u[i - 1], ec[j - 1]):
            if u[i - 1] != ec[j - 1]:
                bad.append(e[j - 1][1])
            i, j = i - 1, j - 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            i -= 1
        else:
            bad.append(e[j - 1][1])
            j -= 1
    return sorted(set(bad))
