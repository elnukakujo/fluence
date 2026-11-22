"""ST-9: a review session counts cards, not progress rows; an exercise is one card however many elements it credits."""
from test_exercise_credit import U, _body, _client, _result

H = {"X-Review-Session": "sess-1"}


def test_an_exercise_with_two_linked_elements_is_one_card(app, db):
    c = _client(app, db)
    r = c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0), _result("voc_V2", 0.0)]), headers=H)
    assert r.status_code == 200
    out = c.get("/api/review/session/sess-1").get_json()
    assert out["cards"] == 1 and out["by_type"] == {"exercise": 1}          # three rows (two elements and the exercise), one card
    assert out["duration_ms"] == 10 and isinstance(out["avg_score_gain"], float)


def test_an_unknown_or_empty_session_gives_zeros_and_another_users_session_is_not_visible(app, db):
    c = _client(app, db)
    c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0)]), headers=H)
    assert c.get("/api/review/session/never-used").get_json()["cards"] == 0
    c.post("/api/exercise/score", json=_body([_result("voc_V1", 1.0)]))      # no header: belongs to no session
    assert c.get("/api/review/session/sess-1").get_json()["cards"] == 1
