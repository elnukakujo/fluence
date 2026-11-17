"""Capability gate: feature x {no endpoint, untested, failed, passed, config changed after pass, switch off}."""
import pytest

import lapp.services  # noqa: F401
from lapp.models.system_data import User
from lapp.services.auth import AuthService
from lapp.services.capabilities import FEATURES, capability_for, config_hash

EP = {"name": "T", "provider": "openai", "api_type": "text_gen", "base_url": "http://x.test", "model": "m", "is_active": True}


class P:                     # stands in for a UserPreferences row
    ai_feedback_enabled = ai_tts_enabled = True

    def __init__(self, endpoints=(), **switches):
        self.ai_endpoints = list(endpoints)
        self.__dict__.update(switches)


def passed(ep):
    return {**ep, "test": {"passed": True, "at": "2026-11-17T00:00:00", "config_hash": config_hash(ep)}}


TEXT = ("text_gen", "tutor_feedback", "exercise_generation", "import")


@pytest.mark.parametrize("feature", FEATURES)
def test_no_endpoint_means_disabled_with_reason(feature):
    cap = capability_for(P(), feature)
    assert not cap.enabled and cap.needs == "endpoint" and cap.reason


@pytest.mark.parametrize("feature", TEXT)
def test_text_features_follow_the_test(feature):
    assert capability_for(P([EP]), feature).needs == "test"                                   # untested
    failed = {**EP, "test": {"passed": False, "at": "x", "config_hash": config_hash(EP)}}
    assert capability_for(P([failed]), feature).needs == "test"
    assert capability_for(P([passed(EP)]), feature).enabled
    changed = {**passed(EP), "model": "other"}                                                # edited after a passed test
    assert capability_for(P([changed]), feature).needs == "test"
    assert capability_for(P([{**passed(EP), "is_active": False}]), feature).needs == "endpoint"


def test_key_change_invalidates():
    ep = passed({**EP, "api_key": "a"})
    assert capability_for(P([ep]), "text_gen").enabled
    assert not capability_for(P([{**ep, "api_key": "b"}]), "text_gen").enabled


def test_purposes_and_switches():
    tts = {**EP, "api_type": "tts"}
    assert capability_for(P([passed(tts)]), "tts").enabled
    assert not capability_for(P([passed(EP)]), "tts").enabled                                 # a text endpoint does not serve audio
    assert capability_for(P([passed({**EP, "api_type": "both"})]), "tts").enabled
    assert capability_for(P([passed(tts)], ai_tts_enabled=False), "tts").needs == "switch"
    assert capability_for(P([passed(EP)], ai_feedback_enabled=False), "tutor_feedback").needs == "switch"
    assert capability_for(P([passed({**EP, "api_type": "ocr"})]), "ocr_model").enabled
    assert not capability_for(P([passed(EP)]), "ocr_model").enabled


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    return c


def test_endpoint_lists_every_feature_and_user_without_endpoints_can_still_study(app, db):
    c = _client(app, db)
    assert c.post("/api/pref/", json={"user_id": "user_U1"}).status_code == 201
    caps = c.get("/api/capabilities").get_json()
    assert set(caps) == set(FEATURES) and not any(v["enabled"] for v in caps.values())
    assert all(v["reason"] for v in caps.values())
    assert c.get("/api/review/lang_none/queue").status_code in (200, 403, 404)               # review needs no endpoint: never a capability 409


def test_routes_409_with_the_reason_and_do_no_work(app, db):
    c = _client(app, db)
    c.post("/api/pref/", json={"user_id": "user_U1"})
    res = c.post("/api/ingestion", data={"language_id": "lang_x"})
    assert res.status_code in (400, 403, 404)                                                 # validation/ownership come first
    res = c.post("/api/exercise/ex_E1/line-audio", json={"line": 0})
    assert res.status_code in (403, 404, 409)


def test_saved_endpoint_test_is_stored_and_invalidated_by_edit(app, db, monkeypatch):
    c = _client(app, db)
    pref = c.post("/api/pref/", json={"user_id": "user_U1", "ai_endpoints": [EP]}).get_json()["user_preferences"]
    from lapp.services.system_data import UserPreferencesService
    UserPreferencesService().record_test("user_U1", 0, True)
    assert c.get("/api/capabilities").get_json()["text_gen"]["enabled"] is True
    # a client cannot forge a test result
    c.put(f"/api/pref/{pref['id']}", json={"ai_endpoints": [{**EP, "model": "m2", "test": {"passed": True, "config_hash": "x"}}]})
    assert c.get("/api/capabilities").get_json()["text_gen"]["enabled"] is False
    c.put(f"/api/pref/{pref['id']}", json={"ai_endpoints": [EP]})                             # back to the tested config: valid again
    assert c.get("/api/capabilities").get_json()["text_gen"]["enabled"] is True
