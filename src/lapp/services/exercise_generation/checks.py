"""Code checks for a generated exercise: cheap, deterministic, run before the judge. The reason returned is shown to the model on a retry and to the user in review."""
import re
from difflib import SequenceMatcher

from ..features.study_constants import GEN_DUPLICATE_RATIO
from ..ingestion.elements import EXERCISE_TYPES, exercise_content_error
from ..ingestion.verify import normalise

ANSWER_REQUIRED = ("answering", "translate")   # the other types derive their answer from `content`; an essay may be open-ended (no answer)


def code_error(item: dict, allowed_ids: set[str]) -> str | None:
    """None if `item` ({exercise_type, question, answer, content, links}) passes, else the first problem."""
    etype = item.get("exercise_type")
    if etype not in EXERCISE_TYPES:
        return f"unknown exercise type {etype!r}"
    if not (item.get("question") or "").strip() and etype not in ("reading", "dictation"):    # their lines are the exercise; the instruction is optional
        return "the question is empty"
    if (error := exercise_content_error(etype, item.get("content"))):
        return error
    if etype in ANSWER_REQUIRED and not (item.get("answer") or "").strip():
        return "the answer is empty"
    if etype == "type_in_the_blank" and not (item.get("text_support") or "").strip():
        return "a type-in gap needs a clue in `text_support` (a word bank, the base form or the translation of each missing word), otherwise the answer is a guess"
    if etype == "type_in_the_blank":
        question, support = normalise(item.get("question") or ""), normalise(item.get("text_support") or "")
        for b in item["content"]["blanks"]:
            a = normalise(b.get("answer") or "")
            # a word bank ("cat, dog") legitimately lists the answer; "answer (gloss)" or the bare answer is a copy
            if a and (a in question or support == a or re.match(rf"{re.escape(a)}\s*[(（:：=-]", support)):
                return "the question or `text_support` gives the answer itself: give its translation or base form, never the answer word"
    if etype == "organize":
        items = [str(i) for i in item["content"]["items"]]
        if len(items) < 3 or all(re.fullmatch(r"[A-Za-zÀ-ÿ]", i) for i in items):
            return "organize must put at least 3 whole words of a sentence in order, never the letters of one word"
    if etype == "matching":
        pairs = [tuple(normalise(x) for x in p) for p in item["content"]["pairs"]]
        if len({p[0] for p in pairs}) != len(pairs) or len({p[1] for p in pairs}) != len(pairs):
            return "matching has a duplicate pair or a repeated side"
    links = item.get("links") or []
    if not links or not set(links) <= allowed_ids:
        return "link the exercise to at least one of the elements it is about (use only the ids given)"
    return None


def is_near_duplicate(item: dict, kept: list[dict]) -> bool:
    """Same question as an already kept exercise: equal once normalised, or at least GEN_DUPLICATE_RATIO similar."""
    q = normalise(item.get("question") or "")
    return any(q == (k := normalise(o.get("question") or "")) or SequenceMatcher(None, q, k).ratio() >= GEN_DUPLICATE_RATIO for o in kept)
