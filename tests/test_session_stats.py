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


def test_type_stats_per_studied_type(app, db):
    """RE-15: the Type tab's figures: total/seen/mean/fading/due per type; another user's language is a 404."""
    c = _client(app, db)
    body = c.get("/api/stats/lang_L1/types")
    assert body.status_code == 200
    out = body.get_json()
    assert set(out) == {"vocabulary", "grammar", "calligraphy", "exercise"}
    assert out["vocabulary"]["total"] == 2 and out["vocabulary"]["seen"] == 0 and out["exercise"]["seen"] is None
    assert c.get("/api/stats/lang_nope/types").status_code == 404
