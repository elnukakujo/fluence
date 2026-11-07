"""Plans which exercises to generate: pure code, no DB and no model. Output is a list of slots {type, elements}."""
import random
from dataclasses import dataclass, field
from typing import Literal, Optional

from ..features.study_constants import (BOOST_FACTOR, GEN_CALL_PER_EXERCISE, GEN_GRAMMAR_EXERCISES, GEN_GUARANTEE_READING_FROM, GEN_MAX,
                                        GEN_MIN, GEN_MULTI_ITEM, GEN_READING_WEIGHT, GEN_VOC_PER_EXERCISE)
from ..ingestion.elements import EXERCISE_TYPES
from ..system_data.exercise_user_pref import effective_mode

Kind = Literal["vocabulary", "grammar", "calligraphy"]
CALLIGRAPHY_TYPES = ("quizz", "type_in_the_blank", "matching", "answering")   # types that make sense for a single character


@dataclass
class PoolItem:
    kind: Kind
    id: str
    label: str
    score: float = 0.0


@dataclass
class Slot:
    exercise_type: str
    items: list[PoolItem] = field(default_factory=list)


def suggest_count(n_vocabulary: int, n_grammar: int, n_calligraphy: int) -> int:
    n = n_vocabulary / GEN_VOC_PER_EXERCISE + n_grammar * GEN_GRAMMAR_EXERCISES + n_calligraphy / GEN_CALL_PER_EXERCISE
    return max(GEN_MIN, min(GEN_MAX, int(n + 0.5)))


def _type_weights(type_prefs: Optional[dict], tts_enabled: bool) -> dict[str, float]:
    weights = {}
    for t in EXERCISE_TYPES:
        mode = effective_mode(type_prefs, t, None)
        if mode == "ban" or (t == "dictation" and not tts_enabled):
            continue
        weights[t] = (BOOST_FACTOR if mode == "boost" else 1.0) * (GEN_READING_WEIGHT if t == "reading" else 1.0)
    return weights


def plan_slots(pool: list[PoolItem], count: int, type_prefs: Optional[dict], tts_enabled: bool,
               rng: Optional[random.Random] = None) -> list[Slot]:
    """`count` slots: every pool item first (weakest first), then weakest-weighted picks; types weighted by the user's boost/ban."""
    rng = rng or random.Random()
    weights = _type_weights(type_prefs, tts_enabled)
    if not pool or not weights or count <= 0:
        return []
    primaries = sorted(pool, key=lambda p: p.score)[:count]
    primaries += rng.choices(pool, weights=[2 - p.score / 100 for p in pool], k=count - len(primaries))
    slots = []
    for primary in primaries:
        allowed = {t: w for t, w in weights.items() if primary.kind != "calligraphy" or t in CALLIGRAPHY_TYPES} or weights
        slots.append(_slot(primary, rng.choices(list(allowed), weights=list(allowed.values()))[0], pool, rng))
    if "reading" in weights and count >= GEN_GUARANTEE_READING_FROM and not any(s.exercise_type == "reading" for s in slots):
        i = rng.choice([i for i, s in enumerate(slots) if s.items[0].kind != "calligraphy"] or [0])
        slots[i] = _slot(slots[i].items[0], "reading", pool, rng)       # a reading is too important to leave to chance
    return slots


def _slot(primary: PoolItem, etype: str, pool: list[PoolItem], rng: random.Random) -> Slot:
    """A slot for `primary`; matching adds same-kind elements, reading and conversation add elements of any kind."""
    items = [primary]
    if etype in GEN_MULTI_ITEM:
        others = [p for p in pool if p.id != primary.id and (etype != "matching" or p.kind == primary.kind)]
        low, high = GEN_MULTI_ITEM[etype]
        items += rng.sample(others, min(len(others), rng.randint(low, high) - 1))
    return Slot(etype, items)
