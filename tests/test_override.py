"""The learner's "I was right": wrong results are credited at full quality once per attempt; a right attempt credits nothing."""
from lapp.services.system_data import ScoreService
from test_exercise_credit import _client, _result, _score, U


def _override(c, results, attempt_id="a1"):
    return c.post("/api/exercise/ex_E1/override", json={"attempt_id": attempt_id, "results": results, "attempt": 1, "duration_ms": 10}).get_json()


def test_override_credits_once(app, db):
    c = _client(app, db)
    wrong = [_result("voc_V1", 0.0), _result("voc_V2", 1.0)]
    first = _override(c, wrong)
    assert first["credited"] and first["total"] == 1       # only the wrong blank is credited
    after = _score("voc_V1")
    assert after > 0
    assert _override(c, wrong) == {"success": True, "credited": False}
    assert _score("voc_V1") == after                       # second call: no change
    assert _override(c, wrong, attempt_id="a2")["credited"]    # another attempt is its own


def test_override_on_a_right_attempt_credits_nothing(app, db):
    c = _client(app, db)
    assert _override(c, [_result("voc_V1", 1.0), _result("voc_V2", 1.0)]) == {"success": True, "credited": False}
    assert _score("voc_V1") == 0.0 and _score("voc_V2") == 0.0


def test_override_needs_an_attempt_id(app, db):
    c = _client(app, db)
    assert c.post("/api/exercise/ex_E1/override", json={"results": []}).status_code == 400
