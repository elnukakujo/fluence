import random

from lapp.services.features.side_pattern import make_side_picker


def draw(picker, n):
    return [picker() for _ in range(n)]


def test_cycle_wraps():
    p = make_side_picker({"mode": "cycle", "cycle": ["F", "F", "B"]})
    assert draw(p, 6) == ["front", "front", "back", "front", "front", "back"]


def test_random_ratio():
    p = make_side_picker({"mode": "random", "front": 3, "back": 1}, rng=random.Random(0))
    share = draw(p, 4000).count("front") / 4000
    assert 0.72 <= share <= 0.78


def test_split_uses_counts():
    p = make_side_picker({"mode": "split"}, front_count=2, back_count=2)
    assert draw(p, 4) == ["front", "front", "back", "back"]


def test_default_is_even_random():
    p = make_side_picker(None, rng=random.Random(1))
    assert 0.45 <= draw(p, 2000).count("front") / 2000 <= 0.55
