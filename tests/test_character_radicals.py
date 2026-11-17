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


def _korean(db):
    from lapp.models.containers import Lesson
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_K", user_id="user_U1", name="K", target_iso639_2t="kor"), session=s, commit=False)
        db.insert(Lesson(id="lesson_K", user_id="user_U1", language_id="lang_K", title="L", position=0), session=s, commit=False)


def test_a_korean_passage_is_created_without_characters(db, monkeypatch):
    from lapp.schemas.components import PassageDict
    from lapp.services import PassageService
    from lapp.services.components import passage as passage_mod
    _korean(db)
    # the Korean romaniser (hangul_romanize) is broken in this environment, which is not what is tested here
    monkeypatch.setattr(passage_mod, "enrich_passage", lambda **k: {"translation": "I am a student", "words": [], "characters": ["나", "는"]})
    assert PassageService().create(PassageDict(language_id="lang_K", text="나는 학생입니다")).id
    with db.session_scope() as s:
        assert s.query(Character).filter_by(language_id="lang_K").count() == 0


def test_a_korean_word_is_created_without_characters(db, monkeypatch):
    from lapp.schemas.components import WordDict
    from lapp.services import WordService
    from lapp.services.components import word as word_mod
    _korean(db)
    monkeypatch.setattr(word_mod, "enrich_word", lambda **k: {"phonetic": "", "translation": "Korean", "word_type": None, "word_gender": None,
                                                            "characters": ["한", "국"], "passages": []})
    assert WordService().create(WordDict(language_id="lang_K", word="한국", translation="Korea")).id
    with db.session_scope() as s:
        assert s.query(Character).filter_by(language_id="lang_K").count() == 0


def test_a_korean_calligraphy_is_a_400_not_a_500(app, db):
    _korean(db)
    r = _client(app).post("/api/calligraphy/", json={"lesson_id": "lesson_K", "character": {"language_id": "lang_K", "character": "한"}})
    assert r.status_code == 400


# --- the form: the learner types a radical and components as characters ---

def _call_update(c, cid, **character):
    return c.put("/api/calligraphy/call_C1", json={"lesson_id": "lesson_L1", "character": {"language_id": "lang_L1", "character": "水", **character}})


def _with_calligraphy(db):
    from lapp.models.features import Calligraphy
    _seed(db)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)


from lapp.models.containers import Lesson   # noqa: E402


def test_typing_a_radical_links_the_existing_character_and_keeps_the_text(app, db):
    _with_calligraphy(db)
    c = _client(app)
    assert _call_update(c, "char_C1", radical="氵").status_code in (200, 201)
    got = c.get("/api/character/char_C1").get_json()
    assert got["key_radical"] == {"id": "char_C2", "character": "氵"} and got["radical"] == "氵"
    got = c.get("/api/character/char_C2").get_json()
    assert got["used_in_refs"] == got["radical_of_refs"] == [{"id": "char_C1", "character": "水"}] and got["component_of_refs"] == []


def test_typing_a_radical_that_does_not_exist_creates_that_character(app, db):
    _with_calligraphy(db)
    c = _client(app)
    _call_update(c, "char_C1", radical="火")
    got = c.get("/api/character/char_C1").get_json()
    assert got["key_radical"]["character"] == "火"
    with db.session_scope() as s:
        assert s.query(Character).filter_by(language_id="lang_L1", character="火").count() == 1


def test_components_are_typed_as_glyphs_and_clearing_the_radical_unlinks(app, db):
    _with_calligraphy(db)
    c = _client(app)
    _call_update(c, "char_C1", radical="氵", component_glyphs=["氵 河"])
    got = c.get("/api/character/char_C1").get_json()
    assert [r["character"] for r in got["component_refs"]] == ["氵", "河"]
    _call_update(c, "char_C1", clear_radical=True, component_glyphs=[])
    got = c.get("/api/character/char_C1").get_json()
    assert got["key_radical"] is None and got["component_refs"] == []


def test_a_radical_that_would_make_a_cycle_is_a_400(app, db):
    _with_calligraphy(db)
    c = _client(app)
    _set(db, "char_C2", components=["char_C1"])           # 氵 is built from 水
    assert _call_update(c, "char_C1", radical="氵").status_code == 400    # so 水 cannot use 氵


def test_editing_the_phonetic_keeps_the_primary_reading_in_step(db):
    _seed(db)
    _set(db, "char_C1", phonetic="shuǐ")
    assert CharacterService().get_by_id("char_C1").readings == [{"kind": "phonetic", "value": "shuǐ", "primary": True}]
    _set(db, "char_C1", phonetic="shui3")
    assert [r["value"] for r in CharacterService().get_by_id("char_C1").readings] == ["shui3"]


# --- migration f2d8b5c1a7e3: link the free-text radicals of existing characters ---

def _link_mig():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("mig10", Path(__file__).parent.parent / "alembic/versions/f2d8b5c1a7e3_link_text_radicals.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _old_data(db):
    """Characters as they are in an existing database: free-text radicals, no links."""
    _seed(db)
    with db.session_scope() as s:
        s.query(Character).delete()
        db.insert(Language(id="lang_K", user_id="user_U1", name="K", target_iso639_2t="kor"), session=s, commit=False)
        for i, (cid, lang, ch, rad, ph) in enumerate([
            ("char_C1", "lang_L1", "放", "方", "fàng"),     # radical 方 does not exist yet
            ("char_C2", "lang_L1", "河", "氵", None),       # radical 氵 exists below
            ("char_C3", "lang_L1", "氵", "水", None),
            ("char_C4", "lang_L1", "方", "方", None),       # its own radical: not linked
            ("char_C5", "lang_L1", "水", "氵", None),       # 水 -> 氵 -> 水 would be a cycle
            ("char_C6", "lang_L1", "木", "木木", None),     # not a single character: left as text
            ("char_C7", "lang_L2", "放", "方", None),       # other language: its own 方
            ("char_C8", "lang_K", "한", "ㅎ", None),         # Korean: left alone
        ]):
            db.insert(Character(id=cid, language_id=lang, character=ch, radical=rad, phonetic=ph), session=s, commit=False)


def test_the_migration_links_text_radicals_creating_missing_ones(db):
    mig = _link_mig()
    _old_data(db)
    with db.session_scope() as s:
        out = mig.link_text_radicals(s.connection())
    with db.session_scope() as s:
        key = {c.id: c.key_radical_id for c in s.query(Character)}
        glyph = {c.id: c.character for c in s.query(Character)}
        lang = {c.id: c.language_id for c in s.query(Character)}
        assert key["char_C2"] == "char_C3" and key["char_C3"] and glyph[key["char_C3"]] == "水"      # existing 水 reused
        assert key["char_C1"] and glyph[key["char_C1"]] == "方" and lang[key["char_C1"]] == "lang_L1"
        assert key["char_C1"] == "char_C4"                       # the existing 方 of that language, not a new one
        assert key["char_C7"] and key["char_C7"] != key["char_C1"] and lang[key["char_C7"]] == "lang_L2"   # created in its own language
        assert key["char_C4"] is None and key["char_C6"] is None and key["char_C8"] is None
        assert key["char_C5"] is None                              # 氵 -> 水 is cut: 水 already points to it would close the 水/氵 loop
        assert out["created"] == 1 and out["skipped_cycle"] == 1
        assert s.query(Character).filter_by(language_id="lang_K").count() == 1


def test_the_migration_is_idempotent_and_backfills_readings(db):
    mig = _link_mig()
    _old_data(db)
    for _ in range(2):
        with db.session_scope() as s:
            out = mig.link_text_radicals(s.connection())
            mig.backfill_readings(s.connection())
    assert out == {"linked": 0, "created": 0, "skipped_cycle": 1}       # second run: nothing new (the cut pair is retried, still a cycle)
    with db.session_scope() as s:
        assert s.get(Character, "char_C1").readings == [{"kind": "phonetic", "value": "fàng", "primary": True}]
        assert s.query(Character).count() == 9


# --- autofill of radical and components for a character added on purpose ---

def _fake_enrich(monkeypatch, radical="氵", components=("氵", "可")):
    from lapp.services.components import character as char_mod
    monkeypatch.setattr(char_mod, "enrich_character", lambda **k: {"phonetic": "", "radical": radical, "meaning": "river", "components": list(components)})


def test_a_new_calligraphy_character_gets_its_radical_and_components_filled(app, db, monkeypatch):
    _seed(db)
    _fake_enrich(monkeypatch)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
    r = _client(app).post("/api/calligraphy/", json={"lesson_id": "lesson_L1", "character": {"language_id": "lang_L1", "character": "湖"}})
    assert r.status_code == 201
    with db.session_scope() as s:
        new = s.query(Character).filter_by(language_id="lang_L1", character="湖").one()
        glyph = {c.id: c.character for c in s.query(Character).filter_by(language_id="lang_L1")}
        assert glyph[new.key_radical_id] == "氵" and new.key_radical_id == "char_C2"          # the existing 氵 is reused
        assert [glyph[i] for i in new.components] == ["氵", "可"]
        assert s.query(Character).filter_by(language_id="lang_L1", character="可").one().components == []   # no cascade


def test_what_the_learner_typed_is_never_overwritten_by_the_autofill(app, db, monkeypatch):
    _seed(db)
    _fake_enrich(monkeypatch)
    with db.session_scope() as s:
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
    _client(app).post("/api/calligraphy/", json={"lesson_id": "lesson_L1", "character": {"language_id": "lang_L1", "character": "湖", "radical": "河", "component_glyphs": ["河"]}})
    with db.session_scope() as s:
        new = s.query(Character).filter_by(language_id="lang_L1", character="湖").one()
        assert new.key_radical_id == "char_C3" and new.components == ["char_C3"]


def test_characters_derived_from_a_passage_stay_unlinked_stubs(db, monkeypatch):
    _seed(db)
    _fake_enrich(monkeypatch)
    c = CharacterService().create(CharacterDict(language_id="lang_L1", character="湖"))     # what a word or passage does
    assert c.key_radical_id is None and c.components == []


def test_the_decomposition_gives_first_level_parts_without_missing_glyphs():
    from lapp.utils.strokes import get_cjk_character_info
    assert get_cjk_character_info("河", "zh")["components"] == ["氵", "可"]
    assert get_cjk_character_info("学", "zh")["components"] == ["子"]          # "No glyph available" is dropped
    assert get_cjk_character_info("a", "fr")["components"] == []


# --- the radical picker's options ---

def test_radical_options_are_only_radicals_and_say_which_the_learner_has(app, db):
    _seed(db)                                   # 氵 exists in lang_L1 (char_C2), 河 and 水 too
    got = _client(app).get("/api/character/radicals?language_id=lang_L1").get_json()
    by = {r["character"]: r for r in got}
    assert len(got) > 100 and by["氵"]["id"] == "char_C2" and by["氵"]["meaning"]
    assert "河" not in by                      # an ordinary character is not a radical
    assert by["火"]["id"] is None              # offered, would be created on save


def test_no_radical_options_for_a_language_without_characters(app, db):
    _seed(db, iso="kor")
    assert _client(app).get("/api/character/radicals?language_id=lang_L1").get_json() == []


# --- cards carry the radical and the components with their glyph ---

def test_a_calligraphy_payload_carries_the_radical_and_components_with_their_glyph(app, db):
    _with_calligraphy(db)
    _set(db, "char_C1", key_radical_id="char_C2", components=["char_C2", "char_C3"])
    got = _client(app).get("/api/calligraphy/call_C1").get_json()["character"]
    assert got["key_radical"] == {"id": "char_C2", "character": "氵"}
    assert [c["character"] for c in got["component_refs"]] == ["氵", "河"]


def test_a_character_without_links_has_none(app, db):
    _with_calligraphy(db)
    got = _client(app).get("/api/calligraphy/call_C1").get_json()["character"]
    assert got["key_radical"] is None and got["component_refs"] == []
