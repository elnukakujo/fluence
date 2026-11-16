"""Spec 2 guards: the score maths and the write path live in one place each."""
import inspect
import re
from pathlib import Path

import lapp.services  # noqa: F401  (settles the import order)
from lapp.utils import helpers

SRC = Path(__file__).parent.parent / "src" / "lapp"
ENGINE = SRC / "utils" / "scoring.py"
DECAY = re.compile(r"0\.5 ?\*\*")      # the half-life form of forgetting
THRESHOLD = re.compile(r"\b(score|level)\w*\s*(>=|<=|>|<)\s*(30|40|60|75|85|90)\b")


def _sources():
    return [(p, p.read_text()) for p in SRC.rglob("*.py") if p != ENGINE]


def test_only_the_engine_computes_decay():
    assert [str(p) for p, t in _sources() if DECAY.search(t)] == []


def test_only_the_engine_holds_level_thresholds():
    assert [(str(p), m.group(0)) for p, t in _sources() for m in THRESHOLD.finditer(t)] == []


def test_the_old_score_helpers_and_status_are_gone():
    assert not any(hasattr(helpers, n) for n in ("update_score", "update_difficulty", "status_for"))


def test_every_score_route_goes_through_the_answer_payload(app):
    """Each POST `/api/**/score` or draw route validates with `answered(...)`; exercises post results (credit), passages are read-only."""
    routes = {r.rule: app.view_functions[r.endpoint] for r in app.url_map.iter_rules()
              if r.rule.startswith("/api") and "POST" in r.methods and re.search(r"/(score|draw)$", r.rule)}
    assert {"/api/vocabulary/score", "/api/grammar/score", "/api/calligraphy/score", "/api/calligraphy/draw"} <= set(routes)
    exempt = {"/api/exercise/score": "credit(", "/api/passage/score": "405"}
    for rule, fn in routes.items():
        src = inspect.getsource(fn)
        assert (exempt[rule] if rule in exempt else "answered(") in src, rule
