"""RC-27: a score route answers with the card's score and level before and after, for the result strip."""
from test_exercise_credit import _client

ANSWER = {"vocabulary_id": "voc_V1", "similarity": 1.0, "evidence_type": "typed", "duration_ms": 100}


def test_a_vocabulary_answer_reports_score_and_level_before_and_after(app, db):
    c = _client(app, db)
    out = c.post("/api/vocabulary/score", json={**ANSWER, "side": "front", "skill": "recognition"}).get_json()
    assert out["success"] and out["score_before"] == 0.0 and out["score_after"] > 0.0
    assert out["level_before"] == "learning" and out["score_after"] <= 100
