"""Per-element exercise credit (spec 2 Task 7): each blank credits its own element, one update per element,
final attempt only, and the response is `correct`/`total` plus a `summary` of what the answer did to the credited elements (the bar under the card)."""
import pytest

from lapp.models.system_data import User, Score
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Vocabulary, Exercise
from lapp.services.auth import AuthService
from lapp.services.system_data import ScoreService
from lapp.services.exercise_generation.checks import code_error
from lapp.services.exercises.credit import group_results

U = "user_U1"


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id=U, name="Japanese", target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id=U, language_id="lang_L1", title="L1"), session=s, commit=False)
        for n in ("1", "2"):
            db.insert(Word(id=f"word_W{n}", language_id="lang_L1", word=f"w{n}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_V{n}", lesson_id="lesson_L1", word_id=f"word_W{n}"), session=s, commit=False)
        ex = Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="type_in_the_blank", question="a__b__c", answer="x, y",
                      content={"segments": ["a", "b", "c"], "blanks": [{"answer": "x", "element_id": "voc_V1"}, {"answer": "y", "element_id": "voc_V2"}]})
        db.insert(ex, session=s, commit=False)
        s.flush()
        ex.related_vocabulary.extend([s.get(Vocabulary, "voc_V1"), s.get(Vocabulary, "voc_V2")])


def _client(app, db):
    _seed(db)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(U, remember=False))
    return c


def _result(eid, q, skill="recall"):
    return {"element_id": eid, "quality": q, "evidence_type": "typed", "skill": skill}


def _body(results, final=True, **over):
    return {"exercise_id": "ex_E1", "results": results, "attempt": 1, "final": final, "duration_ms": 10, "hint_used": False, **over}


def _stability(db, eid):
    with db.session_scope() as s:
        return s.query(Score).filter(Score.user_id == U, Score.element_id == eid).one().stability


def _score(eid):
    row = ScoreService().get(U, eid)
    return row.score if row else 0.0


def test_one_right_one_wrong_credits_each_its_own_element(app, db):
    c = _client(app, db)
    for _ in range(3):
        ScoreService().record(U, "voc_V2", "recall", 1.0, "typed")
    a0, b0 = _score("voc_V1"), _score("voc_V2")
    r = c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V2", 0.0)]))
    assert r.status_code == 200 and {k: r.json[k] for k in ("success", "correct", "total")} == {"success": True, "correct": 1, "total": 2}
    assert _score("voc_V1") > a0 and _score("voc_V2") < b0


def test_two_blanks_on_one_element_make_one_update_from_the_average(app, db):
    c = _client(app, db)
    c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V1", 0.0)]))
    assert _stability(db, "voc_V1#front") == 10 and _score("voc_V1") == 0.0     # one answer of quality 0.5: a pass worth no points; two updates would give 20
    assert _score("voc_V2") == 0.0


def test_a_non_final_attempt_posts_no_score(app, db):
    c = _client(app, db)
    r = c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0)], final=False))
    assert r.status_code == 200 and _score("voc_V1") == 0.0 and _score("ex_E1") == 0.0


def test_final_posts_once_and_returns_no_score(app, db):
    c = _client(app, db)
    r = c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V2", 1.0)]))
    assert "score" not in r.json and (r.json["correct"], r.json["total"]) == (2, 2)     # the elements' own scores are not listed; `summary` is the mean change
    assert _stability(db, "voc_V1#front") == 10


@pytest.mark.parametrize("results", [
    [],                                                  # nothing to credit
    [_result("voc_V9", 1.0)],                            # not linked to the exercise
    [_result("voc_V1", 1.5)],                            # quality out of range
    [_result("voc_V1", 1.0, skill="listening")],         # unknown skill
])
def test_bad_results_are_rejected(app, db, results):
    assert _client(app, db).post("/api/exercise/score", json=_body(results)).status_code == 400


def test_group_results_averages_per_element_and_skill():
    out = group_results([_result("voc_V1", 1.0), _result("voc_V1", 0.5), _result("voc_V2", 0.2),
                         _result("voc_V1", 0.0, skill="recognition")])
    assert out == {("voc_V1", "recall"): (0.75, "typed"), ("voc_V2", "recall"): (0.2, "typed"), ("voc_V1", "recognition"): (0.0, "typed")}


def _item(blank_element):
    return {"exercise_type": "type_in_the_blank", "question": "a__b", "answer": "x", "text_support": "clue",
            "content": {"segments": ["a", "b"], "blanks": [{"answer": "x", "element_id": blank_element}]}, "links": ["voc_V1"]}


def test_generation_accepts_blank_element_in_links_and_rejects_others():
    assert code_error(_item("voc_V1"), {"voc_V1"}) is None
    assert code_error(_item("voc_V9"), {"voc_V1"}) is not None


def test_blank_closeness_is_per_blank():
    from lapp.services.evaluator import EvaluatorService
    blanks = [{"answer": "cat"}, {"answer": "dog"}, {"answer": "bird"}]
    out = EvaluatorService.blank_closeness(blanks, "cat, dig")
    assert out[0] == 1.0 and 0 < out[1] < 1 and out[2] == 0.0


def test_an_exercise_with_no_linked_element_credits_only_itself(app, db):
    c = _client(app, db)
    r = c.post("/api/exercise/score", json=_body([_result("ex_E1", 1.0)]))
    assert (r.status_code, r.json["total"]) == (200, 1)
    assert _score("ex_E1") > 0 and _score("voc_V1") == 0.0


def test_exercise_credit_writes_the_practice_skill_on_a_grammar(app, db):
    from lapp.models.features import Grammar
    c = _client(app, db)
    with db.session_scope() as s:
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        s.flush()
        ex, g = s.get(Exercise, "ex_E1"), s.get(Grammar, "gram_G1")
        ex.related_grammar.append(g)
    r = c.post("/api/exercise/score", json=_body([_result("gram_G1", 1.0, "recognition"), _result("voc_V1", 1.0)]))
    assert r.status_code == 200
    with db.session_scope() as s:
        skills = {x.skill for x in s.query(Score).filter(Score.user_id == U, Score.element_id == "gram_G1")}
    assert skills == {"practice"}
    assert _score("voc_V1") > 0


def test_the_response_summarises_what_the_answer_did_to_the_credited_elements(app, db):
    c = _client(app, db)
    r = c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V2", 1.0)]))
    summary = r.json["summary"]
    assert summary["before"] == 0.0 and summary["after"] == pytest.approx(28.0) and summary["level"] == "learning"     # two first right answers: the mean of two +28
    assert summary["level_up"] is False
    assert _score("voc_V1") == pytest.approx(28.0)


def test_a_wrong_answer_shows_a_drop_in_the_summary(app, db):
    c = _client(app, db)
    ScoreService().record(U, "voc_V1", "recall", 1.0, "typed")
    ScoreService().record(U, "voc_V2", "recall", 1.0, "typed")
    s = c.post("/api/exercise/score", json=_body([_result("voc_V1", 0.0), _result("voc_V2", 0.0)])).json["summary"]
    assert s["after"] < s["before"] and s["level_up"] is False
