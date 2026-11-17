"""The supported-language registry and course creation through the API."""
import pytest

import lapp.services  # noqa: F401  (import order: services before schemas)
from lapp.core.languages import SUPPORTED, language_for
from lapp.models.system_data import User
from lapp.services.auth import AuthService


def test_registry_has_exactly_the_nine():
    assert set(SUPPORTED) == {"en", "es", "fr", "it", "pt", "de", "ja", "zh", "ko"}
    ko = language_for("ko")
    assert (ko.has_characters, ko.has_calligraphy) == (False, False)
    assert all(SUPPORTED[i].has_characters and SUPPORTED[i].has_calligraphy for i in SUPPORTED if i != "ko")
    assert language_for("ja").levels == ("N5", "N4", "N3", "N2", "N1")
    with pytest.raises(ValueError):
        language_for("xx")


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    return c


def test_supported_endpoint_lists_nine(app, db):
    res = _client(app, db).get("/api/languages/supported")
    assert res.status_code == 200 and len(res.get_json()) == 9


def test_create_rejects_unsupported_and_duplicate(app, db):
    c = _client(app, db)
    assert c.post("/api/languages/", json={"name": "Klingon", "iso1": "xx"}).status_code == 400
    assert c.post("/api/languages/", json={"name": "Custom"}).status_code == 400            # free-text course: gone
    res = c.post("/api/languages/", json={"iso1": "fr"})
    assert res.status_code == 201
    lang = res.get_json()["language"]
    assert (lang["iso1"], lang["name"], lang["target_iso639_2t"], lang["flag"]) == ("fr", "French", "fra", "🇫🇷")
    assert c.post("/api/languages/", json={"iso1": "fr"}).status_code == 400                # second fr for one user
    assert c.post("/api/languages/", json={"target_iso639_2t": "jpn", "name": "x"}).status_code == 201   # legacy client field still maps


def test_korean_course_has_no_characters(app, db):
    from lapp.models.containers import Language
    from lapp.schemas.components import CharacterDict
    from lapp.services.components.character import CharacterService
    _client(app, db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_K", user_id="user_U1", name="Korean", iso1="ko", target_iso639_2t="kor"), session=s, commit=False)
    with pytest.raises(ValueError, match="no characters"):
        CharacterService().create(CharacterDict(character="한", language_id="lang_K", user_id="user_U1"))
