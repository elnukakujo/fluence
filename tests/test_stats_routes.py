"""GET /api/stats/<language_id>/summary: one language's home numbers, owner only."""
from test_study_goal import _seed
from test_user_admin_routes import _user_with_session
from lapp.models.system_data import User


def _client(app, token):
    c = app.test_client()
    c.set_cookie("session_token", token)
    return c


def test_owner_gets_the_summary(app, db):
    _seed(db)
    from lapp.services.auth import AuthService
    token = AuthService().create_session("user_U1", remember=False)
    res = _client(app, token).get("/api/stats/lang_L1/summary", headers={"X-Timezone": "UTC"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["id"] == "lang_L1" and "due" in body and "due_minutes" in body


def test_other_user_gets_404(app, db):
    _seed(db)
    from lapp.services.auth import AuthService
    token = AuthService().create_session("user_U2", remember=False)
    assert _client(app, token).get("/api/stats/lang_L1/summary").status_code == 404


def test_no_cookie_is_401(app, db):
    _seed(db)
    assert app.test_client().get("/api/stats/lang_L1/summary").status_code == 401
