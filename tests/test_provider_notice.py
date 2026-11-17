"""One-time provider notice: acknowledged per base URL, idempotent, private to the user."""
from lapp.models.system_data import User
from lapp.services.auth import AuthService


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    assert c.post("/api/pref/", json={"user_id": "user_U1"}).status_code == 201
    return c


def test_notice_is_remembered_once_per_url(app, db):
    c = _client(app, db)
    assert c.post("/api/pref/notice", json={"base_url": "http://a.test/"}).get_json()["provider_notices_seen"] == ["http://a.test"]
    c.post("/api/pref/notice", json={"base_url": "http://a.test"})
    seen = c.post("/api/pref/notice", json={"base_url": "http://b.test"}).get_json()["provider_notices_seen"]
    assert seen == ["http://a.test", "http://b.test"]


def test_notice_needs_a_url_and_a_session(app, db):
    c = _client(app, db)
    assert c.post("/api/pref/notice", json={}).status_code == 400
    assert app.test_client().post("/api/pref/notice", json={"base_url": "x"}).status_code == 401
