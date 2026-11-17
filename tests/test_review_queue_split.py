"""Characterization of the daily queue: the split into collect_candidates / plan_budgets / build_queue must not change it.

Golden file tests/data/review_queue_snapshots.json is the output of the pre-split ReviewService. Regenerate it only for
a deliberate behaviour change: `SNAPSHOT_WRITE=1 python -m pytest tests/test_review_queue_split.py`.
"""
import json
import os
import random
from pathlib import Path

import pytest

from review_helpers import link_all_exercises
from lapp.services import ReviewService  # services first: schemas<->services import cycle
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy, Exercise
from lapp.core.database import db_manager
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.features import StudyGoalService
from lapp.services.system_data import UserPreferencesService

GOLDEN = Path(__file__).parent / "data" / "review_queue_snapshots.json"


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for n in (1, 2):
            db.insert(Lesson(id=f"lesson_L{n}", user_id="user_U1", language_id="lang_L1", title=f"L{n}", position=n), session=s, commit=False)
        for i in range(6):
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id=f"lesson_L{i % 2 + 1}", word_id=f"word_W{i}"), session=s, commit=False)
        for i in range(3):
            db.insert(Grammar(id=f"gram_G{i}", lesson_id="lesson_L1", title=f"g{i}", explanation="e"), session=s, commit=False)
        for i in range(3):
            db.insert(Character(id=f"char_C{i}", language_id="lang_L1", character=f"c{i}"), session=s, commit=False)
            db.insert(Calligraphy(id=f"call_C{i}", lesson_id="lesson_L2", character_id=f"char_C{i}"), session=s, commit=False)
        for i, t in enumerate(["translate", "quizz", "translate", "quizz", "translate"]):
            db.insert(Exercise(id=f"ex_E{i}", lesson_id=f"lesson_L{i % 2 + 1}", exercise_type=t, question="q", answer="a"), session=s, commit=False)


def _prefs(**kw):
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", **kw))


LEARNERS = {
    "no_preferences": lambda: None,
    "weekly_goal": lambda: (_prefs(daily_goal_minutes=8), StudyGoalService().upsert("user_U1", "lang_L1", "week", 3, 1, 1)),
    "layout_sections": lambda: _prefs(daily_goal_minutes=6, review_layout=[{"type": "call", "minutes": None}, {"type": "voc", "minutes": 2},
                                                                          {"type": "gram", "minutes": None}, {"type": "ex", "minutes": None}]),
}


def _snapshot(name):
    random.seed(0)
    link_all_exercises(db_manager)
    cards = ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True)
    return [[c["id"], c.get("side"), c["section"], c["spare"], c["est_seconds"]] for c in cards]


@pytest.mark.parametrize("name", LEARNERS)
def test_queue_is_unchanged(db, name):
    _seed(db)
    LEARNERS[name]()
    got = _snapshot(name)
    golden = json.loads(GOLDEN.read_text()) if GOLDEN.exists() else {}
    if os.environ.get("SNAPSHOT_WRITE"):
        golden[name] = got
        GOLDEN.write_text(json.dumps(golden, indent=1))
    assert got and got == golden[name]
