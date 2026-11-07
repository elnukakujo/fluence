"""Plans which exercises to generate: pure code, no DB and no model. Output is a list of slots {type, elements}."""
import random
from dataclasses import dataclass, field
from typing import Literal, Optional

from ..features.study_constants import (BOOST_FACTOR, GEN_CALL_PER_EXERCISE, GEN_GRAMMAR_EXERCISES, GEN_MAX, GEN_MIN,
                                        GEN_VOC_PER_EXERCISE)
from ..ingestion.elements import EXERCISE_TYPES
from ..system_data.exercise_user_pref import effective_mode

Kind = Literal["vocabulary", "grammar", "calligraphy"]
CALLIGRAPHY_TYPES = ("quizz", "type_in_the_blank", "matching", "answering")   # types that make sense for a single character
MATCHING_SIZE = (2, 4)                                                       # items in one matching exercise


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
        weights[t] = BOOST_FACTOR if mode == "boost" else 1.0
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
        etype = rng.choices(list(allowed), weights=list(allowed.values()))[0]
        items = [primary]
        if etype == "matching":
            others = [p for p in pool if p.kind == primary.kind and p.id != primary.id]
            items += rng.sample(others, min(len(others), rng.randint(MATCHING_SIZE[0], MATCHING_SIZE[1]) - 1))
        slots.append(Slot(etype, items))
    return slots
