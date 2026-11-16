"""Spec 2 Task 9: character readings, key radical, components, radical catalogue, Korean guard."""
import pytest

from lapp.services import CharacterService   # first: it settles the services/schemas import order
from lapp.models.components import Character, RadicalCatalogue
from lapp.models.containers import Language
from lapp.models.system_data import User
from lapp.schemas.components import CharacterDict
from lapp.services.auth import AuthService


def _seed(db, iso="zho"):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="C", target_iso639_2t=iso), session=s, commit=False)
        db.insert(Language(id="lang_L2", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        for i, (ch, lang) in enumerate([("水", "lang_L1"), ("氵", "lang_L1"), ("河", "lang_L1"), ("水", "lang_L2")], 1):
            db.insert(Character(id=f"char_C{i}", language_id=lang, character=ch), session=s, commit=False)
        db.insert(RadicalCatalogue(language_iso="zho", character="氵", phonetic="shuǐ", meaning="water", strokes=3), session=s, commit=False)


def _client(app):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session("user_U1", remember=False))
    return c


def _set(db, cid, **kw):
    return CharacterService().update(cid, CharacterDict(language_id="lang_L1", character=db_char(db, cid), **kw))


def db_char(db, cid):
    with db.session_scope() as s:
        return s.get(Character, cid).character


def test_components_must_belong_to_the_same_language(db):
    _seed(db)
    with pytest.raises(ValueError):
        _set(db, "char_C3", components=["char_C4"])


def test_self_reference_and_cycles_are_rejected(db):
    _seed(db)
    with pytest.raises(ValueError):
        _set(db, "char_C3", components=["char_C3"])
    _set(db, "char_C3", components=["char_C2"])
    with pytest.raises(ValueError):
        _set(db, "char_C2", key_radical_id="char_C3")


def test_used_in_and_radicals_filter(app, db):
    _seed(db)
    _set(db, "char_C3", key_radical_id="char_C2", components=["char_C1"])
    c = _client(app)
    assert c.get("/api/character/char_C2").get_json()["used_in"] == ["char_C3"]
    assert c.get("/api/character/char_C3").get_json()["used_in"] == []
    got = c.get("/api/character/?language_id=lang_L1&radicals=1").get_json()
    assert sorted(x["id"] for x in got) == ["char_C1", "char_C2"]
    assert len(c.get("/api/character/?language_id=lang_L1").get_json()) == 3


def test_readings_shape_is_validated(db):
    _seed(db)
    with pytest.raises(ValueError):
        _set(db, "char_C1", readings=[{"kind": "pinyin"}])
    with pytest.raises(ValueError):
        _set(db, "char_C1", readings=[{"kind": "a", "value": "x", "primary": True}, {"kind": "b", "value": "y", "primary": True}])
    r = _set(db, "char_C1", readings=[{"kind": "pinyin", "value": "shuǐ", "primary": True}])
    assert r.readings == [{"kind": "pinyin", "value": "shuǐ", "primary": True}]


def test_copy_from_catalogue_is_one_editable_character_and_idempotent(app, db):
    _seed(db)
    with db.session_scope() as s:
        cat_id = s.query(RadicalCatalogue).one().id
    c = _client(app)
    a = c.post("/api/character/char_C3/radical", json={"catalogue_id": cat_id})
    b = c.post("/api/character/char_C3/radical", json={"catalogue_id": cat_id})
    assert a.status_code == 200 and b.status_code == 200
    assert a.get_json()["id"] == b.get_json()["id"] == "char_C2"          # 氵 already exists in this language: reused
    assert c.post("/api/character/char_C3/radical", json={"catalogue_id": 999}).status_code == 404


def test_copy_creates_the_character_when_missing(app, db):
    _seed(db)
    with db.session_scope() as s:
        s.delete(s.get(Character, "char_C2"))
        cat_id = s.query(RadicalCatalogue).one().id
    r = _client(app).post("/api/character/char_C3/radical", json={"catalogue_id": cat_id})
    assert r.status_code == 200
    with db.session_scope() as s:
        assert s.query(Character).filter_by(language_id="lang_L1", character="氵").count() == 1
        assert s.get(Character, "char_C3").key_radical_id == r.get_json()["id"]


def test_korean_has_no_characters(app, db):
    _seed(db, iso="kor")
    r = _client(app).post("/api/character/", json={"language_id": "lang_L1", "character": "한"})
    assert r.status_code == 400


def test_a_new_character_stores_its_phonetic_as_the_primary_reading(db):
    _seed(db)
    c = CharacterService().create(CharacterDict(language_id="lang_L1", character="火", phonetic="huǒ", meaning="fire"))
    assert c.readings == [{"kind": "phonetic", "value": "huǒ", "primary": True}]


def test_migration_turns_phonetic_into_one_primary_reading_and_is_idempotent(db):
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("mig9", Path(__file__).parent.parent / "alembic/versions/e1c7a4d9b2f6_character_readings_radicals.py")
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    _seed(db)
    with db.session_scope() as s:
        s.get(Character, "char_C1").phonetic = "shuǐ"
        s.get(Character, "char_C2").phonetic = "x"
        s.get(Character, "char_C2").readings = [{"kind": "mine", "value": "y", "primary": True}]
    for _ in range(2):
        with db.session_scope() as s:
            mig.backfill_readings(s.connection())
    with db.session_scope() as s:
        assert s.get(Character, "char_C1").readings == [{"kind": "phonetic", "value": "shuǐ", "primary": True}]
        assert s.get(Character, "char_C2").readings == [{"kind": "mine", "value": "y", "primary": True}]
        assert s.get(Character, "char_C3").readings == []
