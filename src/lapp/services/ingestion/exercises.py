"""Rebuild imported exercise candidates from the review screen: merge several into one, or regenerate one."""
from . import elements as el
from .types import Chunk
from .verify import normalise


def _finish(raw: dict, etype: str, support: str | None, chunk: Chunk) -> dict:
    """Run the rebuilt exercise through the same checks as an imported one; flat candidate fields + flags + status."""
    cand = el.verify_element("exercise", {**raw, "exercise_type": etype, "text_support": support}, chunk, None)
    if cand is None:  # nothing usable came back
        raise el.ExtractionError("The model did not return a usable exercise")
    return {**cand.fields, "status": cand.status, "quote": cand.quote, "min_conf": cand.min_conf,
            "flags": [f.model_dump() for f in cand.flags]}


def _check_type(exercise_type: str | None) -> None:
    if exercise_type and exercise_type not in el.EXERCISE_TYPES:
        raise ValueError(f"Unknown exercise type: {exercise_type}")


def _describe(item: dict) -> str:
    return "\n".join(p for p in (f"Exercise: {item.get('question') or ''}", item.get("answer") and f"Answer given: {item['answer']}") if p)


JOINABLE = ("type_in_the_blank", "select_in_the_blank", "matching", "organize", "dictation")


def _in_order(content: dict) -> list:
    return [content["items"][i] for i in content.get("answer_order", range(len(content["items"])))]


def _join(items: list[dict], requested: str | None) -> tuple[str, dict] | None:
    """Exact join of same-type structured cards (e.g. a blank exercise the parser cut in two): (type, raw) or None to ask the model."""
    kinds = {i.get("exercise_type") for i in items}
    contents = [i.get("content") for i in items]
    if len(kinds) != 1 or (requested and requested not in kinds) or not all(isinstance(c, dict) for c in contents):
        return None
    etype = kinds.pop()
    try:
        if etype in ("type_in_the_blank", "select_in_the_blank"):
            segs: list[str] = []
            for c in contents:
                nxt = list(c["segments"])
                if segs and segs[-1] and nxt[0] and not segs[-1][-1].isspace() and not nxt[0][0].isspace():
                    segs[-1] += " "          # the cut fell between two words
                segs = segs[:-1] + [segs[-1] + nxt[0]] + nxt[1:] if segs else nxt
            content = {"segments": segs, "blanks": [b for c in contents for b in c["blanks"]]}
            question = "__".join(segs)
        elif etype == "matching":
            content = {"pairs": [p for c in contents for p in c["pairs"]]}
            question = items[0]["question"]
        elif etype == "organize":
            pieces = [w for c in contents for w in _in_order(c)]
            content = {"items": pieces, "answer_order": list(range(len(pieces)))}
            question = " ".join(pieces)
        elif etype == "dictation":
            content = {"lines": [{"text": l["text"]} for c in contents for l in c["lines"]]}
            question = items[0]["question"]
        else:
            return None
    except (KeyError, TypeError, IndexError):
        return None
    first = items[0].get("question") or ""
    consigne = first.split("\n")[0].strip() if "\n" in first else None
    return etype, {"question": question, "consigne": consigne if etype != "dictation" else None, "answer": "", "content": content, "quote": first.split("\n")[-1] or first}


def _rebuild(items: list[dict], chunk: Chunk, api: dict, target: str, exercise_type: str | None, request: str | None, current: str) -> dict:
    supports = list(dict.fromkeys(s.strip() for s in (i.get("text_support") for i in items) if isinstance(s, str) and s.strip()))
    support = "\n\n".join(supports) or None
    joined = _join(items, exercise_type) if len(items) > 1 else None
    if joined:
        return _finish(joined[1], joined[0], support, chunk)
    data = "\n".join(p for p in (support and f"Support text: {support}", *(_describe(i) for i in items),
                                 request and f"Request from the user: {request}") if p)
    if len(items) > 1:
        data = "These exercises become ONE exercise. Keep EVERY exercise below in full, in order: nothing may be dropped.\n" + data
    etype = exercise_type or el.choose_type(data + f"\nPage text:\n{chunk.text}", chunk, api, target, current)
    raw = el.build_item(f"{data}\nPage text (context only):\n{chunk.text}", items[0].get("question") or "", items[0].get("answer"), etype, chunk, api, target)
    if raw is None:
        raise el.ExtractionError("The model did not return an exercise")
    if etype in el.FREE_TEXT and not raw["answer"]:
        raw["answer"] = el._follow_up_answer(chunk, api, raw["question"], support)
    return _finish(raw, etype, support, chunk)


def regenerate_exercise(item: dict, chunk: Chunk, api: dict, target: str, exercise_type: str | None = None, request: str | None = None) -> dict:
    """Rebuild one card from its own fields and the page, as `exercise_type` if given, else the model's pick."""
    _check_type(exercise_type)
    return _rebuild([item], chunk, api, target, exercise_type, (request or "").strip() or None, item.get("exercise_type") or "answering")


def merge_exercises(items: list[dict], chunk: Chunk, api: dict, target: str, exercise_type: str | None = None) -> dict:
    """Join several cards into one exercise; `chunk` holds the page text of every card."""
    _check_type(exercise_type)
    if len(items) < 2:
        raise ValueError("Pick at least two exercises to merge")
    return _rebuild(items, chunk, api, target, exercise_type, None, items[0].get("exercise_type") or "answering")


def combined_chunk(chunks: list[Chunk], chunk_ids: list[str]) -> Chunk | None:
    """The page text of the named chunks as one chunk (the first one's id/page); None if none of them exists."""
    found = [c for i in dict.fromkeys(chunk_ids) for c in chunks if c.id == i]
    return found[0].model_copy(update={"text": "\n".join(c.text for c in found), "prev": "", "next": ""}) if found else None


def _strings(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        value = list(value.values())
    return [t for v in value for t in _strings(v)] if isinstance(value, list) else []


def link_to_elements(fields: dict, vocabulary: list[tuple[str, str]], grammar: list[tuple[str, str]],
                     calligraphy: list[tuple[str, str]]) -> dict[str, list[str]]:
    """The lesson elements ((id, text) pairs: word, grammar title, character) an exercise mentions in its question, answer, support or content."""
    haystack = normalise(" ".join(_strings([fields.get("question"), fields.get("answer"), fields.get("text_support"), fields.get("content")])))
    # ponytail: plain substring match, so a one-letter word links everywhere; a tokenizer-aware match if that shows up in practice
    found = lambda pairs: [i for i, text in pairs if normalise(text) and normalise(text) in haystack]
    return {"related_vocabulary": found(vocabulary), "related_grammar": found(grammar), "related_calligraphy": found(calligraphy)}
