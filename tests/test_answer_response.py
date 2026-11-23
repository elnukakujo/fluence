"""RC-27: a score route answers with the card's score and level before and after, for the result strip."""
from test_exercise_credit import _client

ANSWER = {"vocabulary_id": "voc_V1", "similarity": 1.0, "evidence_type": "typed", "duration_ms": 100}


def test_a_vocabulary_answer_reports_score_and_level_before_and_after(app, db):
    c = _client(app, db)
    out = c.post("/api/vocabulary/score", json={**ANSWER, "side": "front", "skill": "recognition"}).get_json()
    assert out["success"] and out["score_before"] == 0.0 and out["score_after"] > 0.0
    assert out["level_before"] == "learning" and out["score_after"] <= 100


def test_an_answer_that_earns_nothing_because_of_the_daily_cap_says_so(app, db):
    """The strip must not read "7 -> 7" without a reason: the side already gained DAY_GAIN_CAP today."""
    from lapp.utils.learner_clock import learner_today
    from lapp.models.system_data import Score
    c = _client(app, db)
    body = {**ANSWER, "side": "front", "skill": "recognition"}
    assert c.post("/api/vocabulary/score", json=body).get_json()["capped"] is False
    with db.session_scope() as s:
        row = s.query(Score).filter_by(element_id="voc_V1#front", skill="recognition").one()
        row.day_gain, row.day_date = 28.0, learner_today(None)
    out = c.post("/api/vocabulary/score", json=body).get_json()
    assert out["capped"] is True and out["score_after"] == out["score_before"]
