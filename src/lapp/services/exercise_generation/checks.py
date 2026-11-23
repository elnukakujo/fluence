"""Code checks for a generated exercise: cheap, deterministic, run before the judge. The reason returned is shown to the model on a retry and to the user in review."""
import re
from difflib import SequenceMatcher

from ..features.study_constants import GEN_DUPLICATE_RATIO
from ..exercises.registry import EXERCISE_TYPES
from ..exercises.content import exercise_content_error
from ..ingestion.verify import normalise

ANSWER_REQUIRED = ("answering", "translate")   # the other types derive their answer from `content`; an essay may be open-ended (no answer)


GAP = re.compile(r"_{2,}|\[\s*\]|\(\s*\)")                      # a blank to fill
FILL_CUE = re.compile(r"\b(fill|complete|blank|gap|missing|remplis\w*|compl[eè]te\w*|trou|rellena|completa|ergänze|lücke)\b|填空|补全|補全", re.I)
CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
SPEAKING_NOISE = re.compile(r"[:：\"“”«»「」『』]|\n")                     # an instruction, a quotation or a second line


def type_error(item: dict) -> str | None:
    """EG-19..EG-21: each type keeps to its own job. None when it does."""
    etype, q = item.get("exercise_type"), (item.get("question") or "").strip()
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    if etype == "translate":
        a = (item.get("answer") or "").strip()
        if GAP.search(q) or FILL_CUE.search(q):
            return "a translate question is one plain sentence to translate: no gap, no \"fill in / complete\" (a gap is a type_in_the_blank)"
        if " " not in a and not (CJK.search(a) and len(a) >= 2):
            return "a translate answer is the whole translated sentence, not one word (a one-word answer to a gap is a type_in_the_blank)"
    if etype in ("essay", "answering") and (GAP.search(q) or FILL_CUE.search(q)):
        return f"a {etype} is never a gap: write a question or a topic (a gap is a type_in_the_blank)"
    if etype == "speaking" and (SPEAKING_NOISE.search(q) or GAP.search(q)):
        return "a speaking `question` must be ONLY the sentence to say (no instruction, quote, colon, gap or second line): put its meaning in `text_support`"
    if etype in ("conversation", "reading", "dictation") and any(GAP.search(str(l.get("text", ""))) for l in content.get("lines") or [] if isinstance(l, dict)):
        return "no line may hold a gap or blank: every line is a complete sentence that is read aloud"
    return None


SCRIPT_OF = {"Japanese": "kana", "Chinese": "han", "Korean": "hangul", "Russian": "cyrillic", "Ukrainian": "cyrillic", "Macedonian": "cyrillic", "Greek": "greek"}   # any other language of the app: Latin letters
_SCRIPTS = {"kana": re.compile(r"[\u3040-\u30ff]"), "han": re.compile(r"[\u3400-\u9fff]"), "hangul": re.compile(r"[\uac00-\ud7af]"),
            "cyrillic": re.compile(r"[\u0400-\u04ff]"), "greek": re.compile(r"[\u0370-\u03ff]"), "latin": re.compile(r"[A-Za-z\u00c0-\u024f]")}


def written_in(text: str, language: str | None) -> bool | None:
    """Is `text` written in the script of `language`? None when the language is not one we can tell by its letters (or is unknown).
    Latin-script languages cannot be told apart from each other here: French and English both pass as Latin. What it catches is the model
    writing Chinese where Japanese or English belongs: Japanese has kana, Chinese has none, English has no Han at all."""
    if not language or language == "the target language":
        return None
    count = {name: len(rx.findall(text)) for name, rx in _SCRIPTS.items()}
    total = sum(count.values())
    if not total:
        return False
    script = SCRIPT_OF.get(language, "latin")
    if script == "kana":      # Japanese: kana, and kanji with it
        return count["kana"] > 0 and (count["kana"] + count["han"]) / total >= 0.6
    if script == "han":       # Chinese: Han and no kana
        return count["han"] / total >= 0.8 and count["kana"] == 0 and count["hangul"] == 0
    return count[script] / total >= 0.8


def language_error(item: dict, target: str | None, learner: str | None) -> str | None:
    """A translate goes between the lesson's two languages, an answering is answered in the target language (the model copies the languages of its examples)."""
    if not target or target == "the target language":
        return None
    etype, q, a = item.get("exercise_type"), (item.get("question") or ""), (item.get("answer") or "")
    if etype == "translate":
        q_t, a_t = written_in(q, target), written_in(a, target)
        if learner:
            q_l, a_l = written_in(q, learner), written_in(a, learner)
            ok = (q_l is not False and a_t) or (q_t and a_l is not False)        # learner -> target, or target -> learner
        else:
            ok = q_t or a_t                                                      # the learner's language is unknown: one side must be the target
        if not ok:
            return f"a translate goes between {target} and {learner or 'the learner’s language'} only: one side is a {target} sentence, the other its translation, in no other language"
    if etype == "answering" and written_in(a, target) is False:
        return f"an answering `answer` is a full sentence in {target}"
    return None


def code_error(item: dict, allowed_ids: set[str], grammar_ids: set[str] | None = None, languages: tuple[str | None, str | None] | None = None) -> str | None:
    """None if `item` ({exercise_type, question, answer, content, links}) passes, else the first problem.
    `grammar_ids` = the slot's grammars: when given, `links` must name at least one (EG-17).
    `languages` = (target, learner) names: when given, the languages of a translate / answering are checked."""
    etype = item.get("exercise_type")
    if etype not in EXERCISE_TYPES:
        return f"unknown exercise type {etype!r}"
    if not (item.get("question") or "").strip() and etype not in ("reading", "dictation"):    # their lines are the exercise; the instruction is optional
        return "the question is empty"
    if (error := exercise_content_error(etype, item.get("content"))):
        return error
    if etype in ANSWER_REQUIRED and not (item.get("answer") or "").strip():
        return "the answer is empty"
    if (error := type_error(item)):
        return error
    if languages and (error := language_error(item, *languages)):
        return error
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
    content = item.get("content") or {}
    tested = [b.get("element_id") for b in content.get("blanks") or []] + list(content.get("element_ids") or [])
    if any(e is not None and e not in allowed_ids for e in tested):
        return "a blank or pair names an element that is not one of the slot's elements (use only the ids given)"
    links = item.get("links") or []
    if not links or not set(links) <= allowed_ids:
        return "link the exercise to at least one of the elements it is about (use only the ids given)"
    if grammar_ids and not set(links) & grammar_ids:
        return "`links` must include the slot's grammar (the element marked grammar): the exercise has to make the learner apply that grammar point"
    return None


def is_near_duplicate(item: dict, kept: list[dict]) -> bool:
    """Same question as an already kept exercise: equal once normalised, or at least GEN_DUPLICATE_RATIO similar."""
    q = normalise(item.get("question") or "")
    return any(q == (k := normalise(o.get("question") or "")) or SequenceMatcher(None, q, k).ratio() >= GEN_DUPLICATE_RATIO for o in kept)
