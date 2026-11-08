"""How long a review card takes: a content-based prior, blended with the learner's measured pace (see the
review replacement and timing spec). Pure functions; the numbers live in study_constants."""
import re
from statistics import median

from .study_constants import (
    AUDIO_SECONDS, CALL_SECONDS, EXERCISE_TIME, EXERCISE_TIME_DEFAULT, GRAM_BASE, PACE_MAX_FACTOR, PACE_MIN_MS,
    PACE_PRIOR_WEIGHT, PACE_SAMPLES, READ_CHARS_PER_S, READ_WORDS_PER_S, TYPE_CHARS_PER_S, VOC_SECONDS)

_CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
_KEYS = {"Vocabulary": "voc", "Grammar": "gram", "Calligraphy": "call"}


def card_key(card) -> str:
    """Pace bucket: voc / gram / call, or the exercise type."""
    name = type(card).__name__
    return _KEYS.get(name) or getattr(card, "exercise_type", name)


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)


def reading_seconds(*texts) -> float:
    text = " ".join(t for t in texts if t)
    squeezed = re.sub(r"\s", "", text)
    if squeezed and len(_CJK.findall(squeezed)) * 2 > len(squeezed):
        return len(squeezed) / READ_CHARS_PER_S
    return len(text.split()) / READ_WORDS_PER_S


def prior_seconds(card) -> float:
    """Content-based guess of the seconds one card takes."""
    key = card_key(card)
    if key == "voc":
        return VOC_SECONDS
    if key == "call":
        return CALL_SECONDS
    if key == "gram":
        return GRAM_BASE + reading_seconds(card.title, card.explanation)
    spec = EXERCISE_TIME.get(card.exercise_type, EXERCISE_TIME_DEFAULT)
    content = card.content if isinstance(card.content, (dict, list)) else None
    items = sum(len(v) for v in content.values() if isinstance(v, list)) if isinstance(content, dict) else 0
    seconds = spec["base"] + spec["per_item"] * items
    seconds += reading_seconds(card.question, card.text_support, *_strings(content))
    if spec["typed"]:
        seconds += len(card.answer or "") / TYPE_CHARS_PER_S
    lines = content.get("lines") if isinstance(content, dict) else None
    clips = len(lines) if card.exercise_type in ("dictation", "reading") and isinstance(lines, list) else len(card.audio_files or [])
    return seconds + AUDIO_SECONDS * clips


_MODELS = {"vocabulary": "Vocabulary", "grammar": "Grammar", "calligraphy": "Calligraphy", "exercise": "Exercise"}
PACE_HISTORY = 300   # newest progress rows read per review


def pace_ratios(user_id: str, session) -> dict:
    """{card_key: (median actual / prior, n)} over the last PACE_SAMPLES answers of each kind (one query per element model)."""
    from ...models import features
    from ...models.data_collection import ProgressTracking
    rows = (session.query(ProgressTracking).filter(ProgressTracking.user_id == user_id)
            .order_by(ProgressTracking.created_at.desc()).limit(PACE_HISTORY).all())
    elements = {}
    for etype, name in _MODELS.items():
        model, ids = getattr(features, name), [r.element_id for r in rows if r.element_type == etype]
        if ids:
            elements.update({e.id: e for e in session.query(model).filter(model.id.in_(ids)).all()})
    ratios: dict = {}
    for r in rows:
        card = elements.get(r.element_id)
        if card is None:
            continue
        prior = prior_seconds(card)
        seconds = min(max(r.duration_ms, PACE_MIN_MS) / 1000, PACE_MAX_FACTOR * prior)
        ratios.setdefault(card_key(card), []).append(seconds / prior)
    return {k: (median(v[:PACE_SAMPLES]), len(v[:PACE_SAMPLES])) for k, v in ratios.items()}


def estimate_seconds(card, paces: dict) -> float:
    """The prior, pulled toward the learner's measured pace for this kind of card as samples accumulate."""
    prior = prior_seconds(card)
    ratio, n = paces.get(card_key(card), (1.0, 0))
    weight = n / (n + PACE_PRIOR_WEIGHT)
    return prior * (weight * ratio + (1 - weight))
