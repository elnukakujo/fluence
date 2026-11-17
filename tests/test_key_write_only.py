"""API keys are write-only: never serialized, kept when omitted, replaced when sent."""
from lapp.models.system_data import User
from lapp.services.auth import AuthService

EP = {"name": "Mine", "provider": "openai", "api_type": "text_gen", "base_url": "http://x.test", "model": "m",
      "is_active": True, "api_key": "sk-secret-123"}


def _setup(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    res = c.post("/api/pref/", json={"user_id": "user_U1", "ai_endpoints": [EP], "ai_gen_api_key": "sk-legacy-1"})
    assert res.status_code == 201, res.data
    return c, res.get_json()["user_preferences"]


def test_no_key_in_any_response(app, db):
    c, created = _setup(app, db)
    for body in (created, c.get(f"/api/pref/{created['id']}").get_json()):
        assert "sk-secret-123" not in str(body) and "sk-legacy-1" not in str(body)
        assert "api_key" not in str(body.get("ai_endpoints")) and body["ai_endpoints"][0]["has_key"] is True
        assert body["ai_gen_has_key"] is True and "ai_gen_api_key" not in body


def test_update_without_key_keeps_it_and_with_key_replaces(app, db):
    from lapp.core.database import db_manager
    from lapp.models.system_data import UserPreferences
    c, created = _setup(app, db)
    no_key = {k: v for k, v in EP.items() if k != "api_key"}
    assert c.put(f"/api/pref/{created['id']}", json={"ai_endpoints": [{**no_key, "model": "m2"}], "ai_gen_api_key": ""}).status_code == 200
    with db_manager.session_scope() as s:
        p = db_manager.get_by_id(UserPreferences, created["id"], session=s)
        assert p.ai_endpoints[0]["api_key"] == "sk-secret-123" and p.ai_endpoints[0]["model"] == "m2"
        assert p.ai_gen_api_key == "sk-legacy-1"
    c.put(f"/api/pref/{created['id']}", json={"ai_endpoints": [{**EP, "api_key": "sk-new"}]})
    with db_manager.session_scope() as s:
        assert db_manager.get_by_id(UserPreferences, created["id"], session=s).ai_endpoints[0]["api_key"] == "sk-new"
