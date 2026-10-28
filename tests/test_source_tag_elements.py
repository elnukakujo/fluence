"""Source/Tag get_elements() resolves display labels batched — no N+1 client fetch."""
from lapp.models.base import source_element_link, tag_element_link
from lapp.models.system_data import Source, Tag, User
from lapp.models.features import Vocabulary, Grammar
from lapp.models.components import Word
from lapp.models.containers import Language, Lesson


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="t"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="French",
                           target_iso639_2t="fra", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="bonjour"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="past tense"), session=s, commit=False)
        db.insert(Source(id="src_S1", user_id="user_U1", title="Manual", source_type="textbook"), session=s, commit=False)
        db.insert(Tag(id="tag_T1", user_id="user_U1", name="verbs"), session=s, commit=False)

        s.execute(source_element_link.insert().values([
            {"source_id": "src_S1", "element_id": "voc_V1"},
            {"source_id": "src_S1", "element_id": "gram_G1"},
        ]))
        s.execute(tag_element_link.insert().values([
            {"tag_id": "tag_T1", "element_id": "gram_G1"},
        ]))


def test_source_get_elements_resolves_labels(db):
    _seed(db)
    with db.session_scope() as s:
        source = db.get_by_id(Source, "src_S1", session=s)
        elements = source.get_elements()
    assert elements == {
        "voc": [{"id": "voc_V1", "label": "bonjour"}],
        "gram": [{"id": "gram_G1", "label": "past tense"}],
    }


def test_tag_get_elements_resolves_labels(db):
    _seed(db)
    with db.session_scope() as s:
        tag = db.get_by_id(Tag, "tag_T1", session=s)
        elements = tag.get_elements()
    assert elements == {"gram": [{"id": "gram_G1", "label": "past tense"}]}
