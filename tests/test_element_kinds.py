"""The ElementKind registry covers every id prefix and walks ownership/containers as before."""
import pytest

from lapp.core.database import ID_PREFIXES
from lapp.models.components import Character, Passage, Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Calligraphy, Exercise, Grammar, Vocabulary
from lapp.models.system_data import Source, Tag, User, UserPreferences
from lapp.utils.element_kinds import NON_ELEMENT, containers_of, kind_of, owner_of

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


def test_every_id_prefix_has_a_kind_or_is_non_element():
    covered = {k.prefix for k in _all_kinds()}
    for name, prefix in ID_PREFIXES.items():
        stem = prefix[:-1]  # drop the trailing letter, e.g. "voc_V" -> "voc_"
        assert stem in covered or name in NON_ELEMENT, f"{name} ({prefix}) is neither a kind nor non-element"


def _all_kinds():
    # exhaustive list of the registry's kinds, mirrored from element_kinds._KINDS (avoid importing the private dict)
    for eid in ["lang_L1", "lesson_L1", "voc_V1", "gram_G1", "call_C1", "ex_E1", "char_C1", "word_W1", "pass_P1", "tag_T1", "src_S1", "user_U1", "pref_P1", "pt_P1"]:
        k = kind_of(eid)
        assert k is not None, eid
        yield k


def test_kind_of_unknown_returns_none():
    assert kind_of("") is None
    assert kind_of("zzz_1") is None
    assert kind_of(None) is None
    assert kind_of("LANG_L1") is None


def test_kind_of_maps_every_prefix_to_its_model():
    for eid, model in {**FEATURES, **COMPONENTS}.items():
        assert kind_of(eid).model() is model
    assert kind_of("lang_L1").model() is Language and kind_of("lesson_L1").model() is Lesson
    assert kind_of("tag_T1").model() is Tag and kind_of("src_S1").model() is Source
    assert kind_of("pref_P1").model() is UserPreferences and kind_of("user_U1").model() is User


@pytest.mark.parametrize("eid", ["lang_L1", "lesson_L1", *FEATURES, *COMPONENTS, "tag_T1", "src_S1", "pref_P1"])
def test_owner_of(world, eid):
    assert owner_of(eid) == "user_U1"


@pytest.mark.parametrize("eid", ["zzz_1", "", "voc_gone", "lesson_gone", "LANG_L1", "user_U1", "pt_P1"])
def test_owner_of_unknown_is_none(world, eid):
    assert owner_of(eid) is None


def test_containers_of(world):
    assert containers_of("lang_L1") == ("lang_L1", None)
    assert containers_of("lesson_L1") == ("lang_L1", "lesson_L1")
    for eid in FEATURES:
        assert containers_of(eid) == ("lang_L1", "lesson_L1")
    for eid in COMPONENTS:
        assert containers_of(eid) == ("lang_L1", None)
    for eid in ("tag_T1", "zzz_1", "", "voc_gone", "LANG_L1"):
        assert containers_of(eid) == (None, None)
