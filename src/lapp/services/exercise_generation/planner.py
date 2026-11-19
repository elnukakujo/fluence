"""Plans which exercises to generate: pure code, no DB and no model. Output is a list of slots {type, elements}."""
import random
from dataclasses import dataclass, field
from typing import Literal, Optional

from ..audio import exercise_type_offered
from ..features.study_constants import (BOOST_FACTOR, GEN_CALL_PER_EXERCISE, GEN_GRAMMAR_EXERCISES, GEN_GUARANTEE_READING_FROM, GEN_MAX,
                                        GEN_MIN, GEN_MULTI_ITEM, GEN_READING_WEIGHT, GEN_VOC_PER_EXERCISE)
from ..exercises.registry import EXERCISE_TYPES
from ..system_data.exercise_user_pref import effective_mode

Kind = Literal["vocabulary", "grammar", "calligraphy"]
CALLIGRAPHY_TYPES = ("quizz", "type_in_the_blank", "matching", "answering")   # types that make sense for a single character


@dataclass
class PoolItem:
    kind: Kind
    id: str
    label: str
    score: float = 0.0
    own: bool = True        # the lesson's own element; False = borrowed from a same-level lesson (a thin pool, EG-3)


@dataclass
class Slot:
    exercise_type: str
    items: list[PoolItem] = field(default_factory=list)


def suggest_count(n_vocabulary: int, n_grammar: int, n_calligraphy: int) -> int:
    n = n_vocabulary / GEN_VOC_PER_EXERCISE + n_grammar * GEN_GRAMMAR_EXERCISES + n_calligraphy / GEN_CALL_PER_EXERCISE
    return max(GEN_MIN, min(GEN_MAX, int(n + 0.5)))


ADVANCED_TYPES = ("essay", "conversation")     # free production: only for a learner who knows enough words


def _type_weights(type_prefs: Optional[dict], tts_enabled: bool, advanced: bool = True) -> dict[str, float]:
    weights = {}
    for t in EXERCISE_TYPES:
        mode = effective_mode(type_prefs, t, None)
        if mode == "ban" or not exercise_type_offered(t, tts_enabled) or (t in ADVANCED_TYPES and not advanced):
            continue
        weights[t] = (BOOST_FACTOR if mode == "boost" else 1.0) * (GEN_READING_WEIGHT if t == "reading" else 1.0)
    return weights


def offerable_types(type_prefs: Optional[dict], tts_enabled: bool, advanced: bool = True) -> list[str]:
    """The exercise types the user may ask for: not banned, dictation only with a TTS endpoint, essay and conversation only once advanced."""
    return list(_type_weights(type_prefs, tts_enabled, advanced))


def anchors(pool: list[PoolItem]) -> list[PoolItem]:
    """The lesson's own grammars: every exercise is built around one (EG-15). Borrowed grammars never anchor."""
    return [p for p in pool if p.kind == "grammar" and p.own]


def _primaries(pool: list[PoolItem], count: int, rng: random.Random) -> list[PoolItem]:
    """`count` anchors: every grammar first (weakest first), then weakest-weighted repeats."""
    grammars = anchors(pool)
    primaries = sorted(grammars, key=lambda p: p.score)[:count]
    return primaries + rng.choices(grammars, weights=[2 - p.score / 100 for p in grammars], k=count - len(primaries))


def plan_slots_from_mix(pool: list[PoolItem], mix: dict[str, int], rng: Optional[random.Random] = None) -> list[Slot]:
    """Exactly `mix` ({type: n}) as slots, each anchored on a grammar: the same primaries as `plan_slots`; a slot takes
    the type that has the most left."""
    rng = rng or random.Random()
    left = {t: n for t, n in mix.items() if n > 0}
    count = sum(left.values())
    if not anchors(pool) or not count:
        return []
    slots = []
    for primary in _primaries(pool, count, rng):
        best = max(n for n in left.values() if n > 0)
        etype = rng.choice([t for t, n in left.items() if n == best])
        left[etype] -= 1
        slots.append(_slot(primary, etype, pool, rng))
    return slots


def plan_slots(pool: list[PoolItem], count: int, type_prefs: Optional[dict], tts_enabled: bool,
               rng: Optional[random.Random] = None, advanced: bool = True) -> list[Slot]:
    """`count` slots, each anchored on one of the lesson's grammars (weakest first, then weakest-weighted repeats); types weighted by the user's boost/ban.
    No grammar in the lesson, no slot."""
    rng = rng or random.Random()
    weights = _type_weights(type_prefs, tts_enabled, advanced)
    if not anchors(pool) or not weights or count <= 0:
        return []
    slots = [_slot(primary, rng.choices(list(weights), weights=list(weights.values()))[0], pool, rng) for primary in _primaries(pool, count, rng)]
    if "reading" in weights and count >= GEN_GUARANTEE_READING_FROM and not any(s.exercise_type == "reading" for s in slots):
        i = rng.randrange(len(slots))
        slots[i] = _slot(slots[i].items[0], "reading", pool, rng)       # a reading is too important to leave to chance
    return slots


def _slot(primary: PoolItem, etype: str, pool: list[PoolItem], rng: random.Random) -> Slot:
    """A slot: the anchor grammar first, then companions (vocabulary, and calligraphy for the single-character types) so the exercise also trains them.
    Matching, reading and conversation take a few; the other types one when there is one."""
    others = [p for p in pool if p.id != primary.id and p.kind != "grammar" and (p.kind != "calligraphy" or etype in CALLIGRAPHY_TYPES or etype in GEN_MULTI_ITEM)]
    low, high = GEN_MULTI_ITEM.get(etype, (1, 2))
    others.sort(key=lambda p: p.score)
    companions = rng.sample(others[:max(3, high)], min(len(others), rng.randint(low, high) - 1))
    return Slot(etype, [primary, *companions])
