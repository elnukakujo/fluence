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


def test_type_stats_cards_counts_both_sides_of_a_vocabulary(app, db):
    """RC-27: the picker says how many cards the queue will hold: 2 sides per word."""
    out = _client(app, db).get("/api/stats/lang_L1/types").get_json()
    assert out["vocabulary"]["cards"] == 4 and out["vocabulary"]["total"] == 2


# ---- RC-27: the end screen's extra fields --------------------------------------------------------------------------------------------
from lapp.models.data_collection.progress_tracking import ProgressTracking


def _pt(db, n, element_id, before, after, result=True, card_id=None, hint=False, sess="s2", etype="vocabulary", ms=2000):
    with db.session_scope() as s:
        db.insert(ProgressTracking(id=f"pt_{n}", user_id=U, language_id="lang_L1", element_id=element_id, element_type=etype, element_status="seen",
                                   score_before=before, score_after=after, result=result, duration_ms=ms, hint_used=hint, attempt_number=1,
                                   session_id=sess, card_id=card_id or element_id), session=s, commit=False)


def test_levels_crossed_only_upwards_with_the_word_as_label(app, db):
    c = _client(app, db)
    _pt(db, 1, "voc_V1#front", 40, 62)            # learning -> known
    _pt(db, 2, "voc_V2#front", 70, 50)            # known -> learning: never listed
    out = c.get("/api/review/session/s2").get_json()
    assert out["levels_crossed"] == [{"id": "voc_V1", "label": "w1", "from": "learning", "to": "known"}]


def test_a_missed_card_is_listed_once_and_an_exercise_under_its_own_id(app, db):
    c = _client(app, db)
    _pt(db, 1, "voc_V1#front", 40, 30, result=False)
    _pt(db, 2, "voc_V1#back", 40, 30, result=False)
    _pt(db, 3, "voc_V2#front", 40, 50, result=True)
    _pt(db, 4, "ex_E1", 40, 30, result=False, card_id="ex_E1", etype="exercise")
    _pt(db, 5, "voc_V2", 40, 30, result=False, card_id="ex_E1")
    assert sorted(c.get("/api/review/session/s2").get_json()["to_revisit"]) == ["ex_E1", "voc_V1"]


def test_hints_pace_and_goal_progress(app, db):
    c = _client(app, db)
    _pt(db, 1, "voc_V1#front", 10, 20, hint=True, ms=4000)
    _pt(db, 2, "voc_V2#front", 10, 20, hint=True, ms=2000)
    out = c.get("/api/review/session/s2").get_json()
    assert out["hints_used"] == 2 and out["avg_seconds_per_card"] == 3.0
    assert out["goal_progress"] is None and out["levels_crossed"] == [] and out["to_revisit"] == []


def test_an_unknown_session_keeps_the_zero_shape_with_the_new_empty_fields(app, db):
    out = _client(app, db).get("/api/review/session/none").get_json()
    assert out["levels_crossed"] == [] and out["to_revisit"] == [] and out["hints_used"] == 0 and out["goal_progress"] is None
