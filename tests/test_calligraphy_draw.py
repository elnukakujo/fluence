"""Calligraphy drawing practice: scoring function + /api/calligraphy/draw route."""
from lapp.utils.helpers import score_drawing
from lapp.services.auth import AuthService
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Character
from lapp.models.features import Calligraphy


def test_score_drawing_perfect():
    assert score_drawing(1.0, 0) == 1.0


def test_score_drawing_order_penalty():
    assert score_drawing(1.0, 2) == 0.8      # 1.0 * (1 - 0.2)


def test_score_drawing_shape_scales_penalty():
    assert score_drawing(0.5, 1) == 0.45     # 0.5 * 0.9


def test_score_drawing_floor_at_zero():
    assert score_drawing(0.9, 20) == 0.0


def test_score_drawing_clamps_similarity_to_one():
    assert score_drawing(2.0, 0) == 1.0


def test_score_drawing_clamps_similarity_to_zero():
    assert score_drawing(-1.0, 0) == 0.0


def test_score_drawing_clamps_negative_errors():
    assert score_drawing(1.0, -5) == 1.0


def _seed_calligraphy(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com", is_admin=True), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Character(id="char_C1", language_id="lang_L1", character="水"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)


def _client_with_user(app, db, uid, username, email):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=username, email=email), session=s, commit=False)
    token = AuthService().create_session(uid, remember=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def test_draw_calligraphy_updates_score(app, db):
    _seed_calligraphy(db)
    client = _client_with_user(app, db, "user_U1", "a", "a@x.com")
    res = client.post('/api/calligraphy/draw', json={
        'calligraphy_id': 'call_C1', 'similarity': 1.0, 'stroke_order_errors': 0, 'duration_ms': 100,
    })
    assert res.status_code == 200
    body = res.get_json()
    assert body['success'] is True
    assert body['calligraphy']['score'] > 0


def test_draw_calligraphy_rejects_non_owner(app, db):
    _seed_calligraphy(db)
    client = _client_with_user(app, db, "user_U2", "b", "b@x.com")
    res = client.post('/api/calligraphy/draw', json={
        'calligraphy_id': 'call_C1', 'similarity': 1.0, 'stroke_order_errors': 0, 'duration_ms': 100,
    })
    assert res.status_code == 403
