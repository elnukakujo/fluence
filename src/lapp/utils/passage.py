"""Is a vocabulary entry a whole sentence rather than a word or a short phrase?"""
import re

from lapp.services.features.study_constants import PASSAGE_MIN_CJK_CHARS, PASSAGE_MIN_WORDS

_CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
_FINAL = re.compile(r"[.!?。！？]\s*$")


def is_passage(word: str, word_type: str | None = None) -> bool:
    if word_type == "sentence":
        return True
    text = (word or "").strip()
    if not text:
        return False
    words, cjk = len(text.split()), len(_CJK.findall(text))
    if words >= PASSAGE_MIN_WORDS or cjk >= PASSAGE_MIN_CJK_CHARS:
        return True
    return bool(_FINAL.search(text)) and (words >= 3 or cjk >= 4)      # ends like a sentence ("Mr. Smith" alone does not)
