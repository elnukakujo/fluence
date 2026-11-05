from datetime import date, timedelta

import pytest

from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word, Character
from lapp.models.features import Vocabulary, Grammar, Calligraphy
from lapp.services.auth import AuthService
from lapp.services.features import StudyGoalService
from lapp.services.system_data import ScoreService

D0 = date(2026, 1, 1)


def _seed(db, n=3):
    with db.session_scope() as s:
        for u in ("user_U1", "user_U2"):
            db.insert(User(id=u, username=u, email=f"{u}@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for lid, pos in (("lesson_A", 0), ("lesson_B", 1)):
            db.insert(Lesson(id=lid, user_id="user_U1", language_id="lang_L1", title=lid, position=pos), session=s, commit=False)
        for i in range(n):
            lesson = "lesson_A" if i < 2 else "lesson_B"
            db.insert(Word(id=f"word_W{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{i}", lesson_id=lesson, word_id=f"word_W{i}"), session=s, commit=False)
            db.insert(Grammar(id=f"gram_G{i}", lesson_id=lesson, title=f"g{i}", explanation="e"), session=s, commit=False)
            db.insert(Character(id=f"char_C{i}", language_id="lang_L1", character=f"c{i}"), session=s, commit=False)
            db.insert(Calligraphy(id=f"call_C{i}", lesson_id=lesson, character_id=f"char_C{i}"), session=s, commit=False)


def _goal(svc, **kw):
    args = dict(period="week", n_vocabulary=2, n_grammar=1, n_calligraphy=3, today=D0)
    args.update(kw)
    return svc.upsert("user_U1", "lang_L1", **args)


def test_first_cycle_picks_per_type_in_lesson_order(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc)
    ids = sorted(i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0))
    assert ids == ["call_C0", "call_C1", "call_C2", "gram_G0", "voc_V0", "voc_V1"]
    assert len(svc.ensure_cycle("user_U1", "lang_L1", today=D0)) == 6      # same day adds nothing


def test_next_cycle_adds_new_and_carries_unmastered(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_calligraphy=0, n_grammar=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    ScoreService().set("user_U1", "voc_V0", score=80.0, difficulty=0.5)   # mastered
    open_ids = {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0 + timedelta(days=7))}
    assert open_ids == {"voc_V1", "voc_V2"}                                # V1 carried, V2 new, V0 left
    p = svc.progress("user_U1", "lang_L1", today=D0 + timedelta(days=7))
    assert p["types"]["vocabulary"] == {"n": 2, "picked": 1, "mastered": 0, "carried": 1}


def test_fewer_unstarted_than_n(db):
    _seed(db, n=1)
    svc = StudyGoalService()
    _goal(svc, n_vocabulary=5)
    assert len([i for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0) if i.element_id.startswith("voc_")]) == 1
    assert svc.progress("user_U1", "lang_L1", today=D0)["types"]["vocabulary"]["picked"] == 1


def test_inactive_picks_nothing(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, active=False)
    assert svc.ensure_cycle("user_U1", "lang_L1", today=D0) == []


def test_deleted_element_is_dropped(db):
    _seed(db)
    svc = StudyGoalService()
    _goal(svc, n_grammar=0, n_calligraphy=0)
    svc.ensure_cycle("user_U1", "lang_L1", today=D0)
    with db.session_scope() as s:
        s.delete(s.get(Vocabulary, "voc_V0"))
    ids = {i.element_id for i in svc.ensure_cycle("user_U1", "lang_L1", today=D0)}
    assert "voc_V0" not in ids


def test_validation(db):
    _seed(db)
    for bad in (dict(period="day"), dict(n_vocabulary=-1), dict(n_grammar="x")):
        with pytest.raises(ValueError):
            _goal(StudyGoalService(), **bad)


def test_routes(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    assert c.get("/api/study-goal/lang_L1").get_json() == {"goal": None, "progress": None}
    assert c.put("/api/study-goal/lang_L1", json={"period": "day"}).status_code == 400
    ok = c.put("/api/study-goal/lang_L1", json={"period": "biweek", "n_vocabulary": 2, "n_grammar": 1, "n_calligraphy": 0})
    assert ok.status_code == 200 and ok.get_json()["progress"]["types"]["vocabulary"]["picked"] == 2
    assert c.post("/api/study-goal/lang_L1/pick").status_code == 200
    other = app.test_client()
    other.set_cookie("session_token", AuthService().create_session("user_U2", remember=False))
    assert other.get("/api/study-goal/lang_L1").status_code == 403
