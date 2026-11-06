"""Rebuild imported exercise candidates from the review screen: merge several into one, or regenerate one."""
from . import elements as el
from .types import Chunk


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


def _rebuild(items: list[dict], chunk: Chunk, api: dict, target: str, exercise_type: str | None, request: str | None, current: str) -> dict:
    supports = list(dict.fromkeys(s.strip() for s in (i.get("text_support") for i in items) if isinstance(s, str) and s.strip()))
    support = "\n\n".join(supports) or None
    data = "\n".join(p for p in (support and f"Support text: {support}", *(_describe(i) for i in items),
                                 request and f"Request from the user: {request}") if p)
    if len(items) > 1:
        data = "These exercises become ONE exercise covering all of them.\n" + data
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
