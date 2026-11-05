"""Which side (front/back) the next vocabulary card of the queue should be."""
import random
from typing import Callable, Optional


def make_side_picker(
    pattern: Optional[dict],
    rng: Optional[random.Random] = None,
    front_count: int = 0,
    back_count: int = 0,
) -> Callable[[], str]:
    """Return a callable yielding "front" / "back" for each successive vocabulary slot.

    `pattern` is `UserPreferences.voc_side_pattern` (None = random 1:1). `split` serves
    `front_count` fronts, then backs (after that, backs).
    """
    rng = rng or random.Random()
    pattern = pattern or {"mode": "random", "front": 1, "back": 1}
    mode = pattern["mode"]
    state = {"i": 0}

    def pick() -> str:
        i = state["i"]
        state["i"] += 1
        if mode == "cycle":
            return "front" if pattern["cycle"][i % len(pattern["cycle"])] == "F" else "back"
        if mode == "split":
            return "front" if i < front_count else "back"
        f, b = pattern["front"], pattern["back"]
        return "front" if rng.random() * (f + b) < f else "back"

    return pick
