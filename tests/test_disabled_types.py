"""SG-14: a type the course does not study is absent from every surface of its language; its data is kept and comes back when it is switched on again."""
from collab_helpers import client_for, seed

from lapp.models.components import Character, Word
from lapp.models.features import Calligraphy, Exercise, Grammar
from lapp.services.system_data import ScoreService

L = "lang_L1"
ALL = ["vocabulary", "grammar", "calligraphy", "exercises"]


def _world(db):
    seed(db)
    with db.session_scope() as s:
        db.insert(Character(id="char_C1", language_id=L, character="海", meaning="sea"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="は topic", explanation="e"), session=s, commit=False)
        ex = Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="true_false", question="sea?", answer="true", content={"statement": "s", "answer": True})
        db.insert(ex, session=s, commit=False)
        s.flush()
        ex.related_calligraphy.append(s.get(Calligraphy, "call_C1"))


def _studies(c, types):
    r = c.put("/api/pref/settings/review", json={"values": {"element_types": types}, "language_id": L})
    assert r.status_code == 200, r.get_json()


def _first_use(app, db):
    _world(db)
    from lapp.models.system_data import UserPreferences
    return client_for(app, "user_U1")


def test_custom_review_of_a_disabled_type_is_empty_and_the_type_tab_does_not_list_it(app, db):
    c = _first_use(app, db)
    assert len(c.get(f"/api/review/{L}/queue?scope=type&type=calligraphy").get_json()) == 1
    assert "calligraphy" in c.get(f"/api/stats/{L}/types").get_json()
    _studies(c, ["vocabulary", "grammar", "exercises"])
    assert c.get(f"/api/review/{L}/queue?scope=type&type=calligraphy").get_json() == []          # 200 and empty
    assert "calligraphy" not in c.get(f"/api/stats/{L}/types").get_json()
    _studies(c, ALL)
    assert len(c.get(f"/api/review/{L}/queue?scope=type&type=calligraphy").get_json()) == 1      # nothing was deleted


def test_search_does_not_offer_a_disabled_type(app, db):
    c = _first_use(app, db)
    assert any(r["type"] == "calligraphy" for r in c.get("/api/search", query_string={"q": "海"}).get_json()["results"])
    _studies(c, ["vocabulary", "grammar", "exercises"])
    assert not any(r["type"] == "calligraphy" for r in c.get("/api/search", query_string={"q": "海"}).get_json()["results"])


def test_an_exercise_does_not_show_links_to_a_disabled_type_but_keeps_them(app, db):
    c = _first_use(app, db)
    assert c.get("/api/exercise/ex_E1").get_json()["related_calligraphy"] == ["call_C1"]
    _studies(c, ["vocabulary", "grammar", "exercises"])
    assert c.get("/api/exercise/ex_E1").get_json()["related_calligraphy"] == []
    assert c.get("/api/exercise/lesson/lesson_L1").get_json()[0]["related_calligraphy"] == []
    _studies(c, ALL)
    assert c.get("/api/exercise/ex_E1").get_json()["related_calligraphy"] == ["call_C1"]


def test_lesson_score_ignores_a_disabled_type_and_saving_the_setting_refreshes_it(app, db):
    c = _first_use(app, db)
    sc = ScoreService()
    sc.set("user_U1", "voc_V1", score=80.0, difficulty=0.5)
    sc.set("user_U1", "call_C1", score=20.0, difficulty=0.5)
    from lapp.services.containers import LessonService
    LessonService().update_score("lesson_L1", user_id="user_U1")
    both = sc.get("user_U1", "lesson_L1").score
    _studies(c, ["vocabulary", "grammar", "exercises"])
    assert sc.get("user_U1", "lesson_L1").score > both and round(sc.get("user_U1", "lesson_L1").score) == 40      # voc 80 and the unseen grammar 0; calligraphy 20 no longer drags it
    _studies(c, ALL)
    assert sc.get("user_U1", "lesson_L1").score == both


def test_the_generator_pool_has_no_disabled_type(app, db):
    c = _first_use(app, db)
    from lapp.services.exercise_generation.pool import lesson_pool
    with db.session_scope() as s:
        assert {p.kind for p in lesson_pool("lesson_L1", "user_U1", s)} == {"vocabulary", "grammar", "calligraphy"}
    _studies(c, ["vocabulary", "exercises"])
    with db.session_scope() as s:
        assert {p.kind for p in lesson_pool("lesson_L1", "user_U1", s)} == {"vocabulary"}
