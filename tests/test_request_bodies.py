"""A missing or empty body is a 400 with the field errors, never a 500 (D7/B9)."""
import lapp.services  # noqa: F401
from lapp.models.system_data import User
from lapp.services.auth import AuthService


def test_missing_body_is_a_400(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    for url in ("/api/lessons/", "/api/tags/", "/api/grammar/"):
        res = c.post(url)                                   # no body at all
        assert res.status_code == 400, (url, res.status_code, res.data)
        res = c.post(url, json={})
        assert res.status_code == 400, (url, res.status_code)
