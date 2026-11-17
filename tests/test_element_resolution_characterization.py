"""Characterization (L0): what the four prefix resolvers return today. Must stay green, unchanged,
through the registry refactor (plan Tasks 5-6)."""
import pytest

from lapp.core.auth import _resolve_containers, owner_user_id
from lapp.models.components import Character, Passage, Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Calligraphy, Exercise, Grammar, Vocabulary
from lapp.models.system_data import Source, Tag, User, UserPreferences
from lapp.services.bulk import model_of
from lapp.utils.resolve_orm_table import resolve_element_model

FEATURES = {"voc_V1": Vocabulary, "gram_G1": Grammar, "call_C1": Calligraphy, "ex_E1": Exercise}
COMPONENTS = {"word_W1": Word, "pass_P1": Passage, "char_C1": Character}


@pytest.fixture()
def world(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="u", email="u@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="L"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Passage(id="pass_P1", language_id="lang_L1", text="x"), session=s, commit=False)
        db.insert(Character(id="char_C1", language_id="lang_L1", character="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="essay", question="q", answer="a"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", name="t", user_id="user_U1"), session=s, commit=False)
        db.insert(Source(id="src_S1", title="s", source_type="textbook", user_id="user_U1"), session=s, commit=False)
        db.insert(UserPreferences(id="pref_P1", user_id="user_U1"), session=s, commit=False)


@pytest.mark.parametrize("eid", ["lang_L1", "lesson_L1", *FEATURES, *COMPONENTS, "tag_T1", "src_S1", "pref_P1"])
def test_owner_user_id_per_prefix(world, eid):
    assert owner_user_id(eid) == "user_U1"


@pytest.mark.parametrize("eid", ["zzz_1", "", "voc_gone", "lesson_gone", "LANG_L1", "word_gone"])
def test_owner_user_id_unknown_is_none(world, eid):
    assert owner_user_id(eid) is None


def test_resolve_containers(world):
    assert _resolve_containers("lang_L1") == ("lang_L1", None)
    assert _resolve_containers("lesson_L1") == ("lang_L1", "lesson_L1")
    for eid in FEATURES:
        assert _resolve_containers(eid) == ("lang_L1", "lesson_L1")
    for eid in COMPONENTS:
        assert _resolve_containers(eid) == ("lang_L1", None)
    for eid in ("tag_T1", "zzz_1", "", "voc_gone", "LANG_L1"):
        assert _resolve_containers(eid) == (None, None)


def test_resolve_element_model(db):
    for eid, model in {**FEATURES, **COMPONENTS}.items():
        assert resolve_element_model(eid) is model
    assert resolve_element_model("lang_L1") is Language and resolve_element_model("lesson_L1") is Lesson
    assert resolve_element_model("tag_T1") is Tag and resolve_element_model("src_S1") is Source
    assert resolve_element_model("pref_P1") is UserPreferences
    assert resolve_element_model("zzz_1") is None and resolve_element_model("") is None
    assert resolve_element_model("LANG_L1") is None


def test_model_of(db):
    for eid, model in FEATURES.items():
        assert model_of(eid) is model
    assert model_of("lesson_L1") is None and model_of("lesson_L1", containers=True) is Lesson
    assert model_of("lang_L1", containers=True) is Language
    assert model_of("zzz_1") is None and model_of("") is None and model_of(None) is None
