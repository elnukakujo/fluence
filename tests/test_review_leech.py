"""Leech cards: a card whose score fell LEECH_LAPSES times gets its lapses, the word's characters and one confusable word; the user's note rides on the score."""
import itertools

from lapp.models.components import Character, Word
from lapp.models.containers import Language, Lesson
from lapp.models.data_collection import ProgressTracking
from lapp.models.features import Calligraphy, Vocabulary
from lapp.models.system_data import User
from lapp.services import ReviewService
from lapp.services.auth import AuthService
from lapp.services.features.study_constants import LEECH_LAPSES
from lapp.services.system_data import ScoreService

_ids = itertools.count(1)


def _seed(db, other="日本人", other_translation="Japanese person"):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="C", target_iso639_2t="zho"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        sun = Character(id="char_C1", language_id="lang_L1", character="日", phonetic="rì", meaning="sun")
        book = Character(id="char_C2", language_id="lang_L1", character="本", phonetic="běn", meaning="book")
        japan = Word(id="word_W1", language_id="lang_L1", word="日本", translation="Japan", phonetic="rìběn")
        japan.characters = [sun, book]
        for obj in (sun, book, japan):
            db.insert(obj, session=s, commit=False)
        if other:
            db.insert(Word(id="word_W2", language_id="lang_L1", word=other, translation=other_translation, phonetic="rìběnrén"), session=s, commit=False)
        db.insert(Word(id="word_W3", language_id="lang_L1", word="苹果", translation="apple", phonetic="píngguǒ"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Calligraphy(id="call_C1", lesson_id="lesson_L1", character_id="char_C1"), session=s, commit=False)


def _history(db, element_id, down, up=0):
    with db.session_scope() as s:
        for before, after in [(50.0, 40.0)] * down + [(40.0, 50.0)] * up:
            db.insert(ProgressTracking(id=f"pt_{next(_ids)}", user_id="user_U1", language_id="lang_L1", element_id=element_id, element_type="vocabulary",
                                       element_status="learning", score_before=before, score_after=after, result=after >= before, duration_ms=1000),
                      session=s, commit=False)


def _cards():
    return [{"id": "voc_V1", "word_id": "word_W1", "word": {"id": "word_W1", "word": "日本", "translation": "Japan", "phonetic": "rìběn"}},
            {"id": "call_C1", "character_id": "char_C1", "character": {"id": "char_C1", "character": "日"}}]


def _annotate(cards):
    return ReviewService().annotate_leeches(cards, "user_U1", "lang_L1")


def test_a_card_becomes_a_leech_at_the_lapse_threshold_and_improvements_do_not_count(db):
    _seed(db)
    _history(db, "voc_V1", LEECH_LAPSES - 1, up=5)
    assert "leech" not in _annotate(_cards())[0]
    _history(db, "voc_V1", 1)
    assert _annotate(_cards())[0]["leech"]["lapses"] == LEECH_LAPSES


def test_a_leech_vocabulary_lists_the_characters_of_its_word_and_a_calligraphy_leech_has_none(db):
    _seed(db)
    _history(db, "voc_V1", LEECH_LAPSES)
    _history(db, "call_C1", LEECH_LAPSES)
    voc, call = _annotate(_cards())
    assert {p["character"]: p["meaning"] for p in voc["leech"]["parts"]} == {"日": "sun", "本": "book"}
    assert call["leech"]["parts"] == [] and call["leech"]["confusable"] is None


def test_the_confusable_is_the_closest_other_word_of_the_language(db):
    _seed(db)
    _history(db, "voc_V1", LEECH_LAPSES)
    assert _annotate(_cards())[0]["leech"]["confusable"] == {"word": "日本人", "translation": "Japanese person"}


def test_no_close_word_means_no_confusable_and_a_synonym_is_never_one(db):
    _seed(db, other=None)
    _history(db, "voc_V1", LEECH_LAPSES)
    assert _annotate(_cards())[0]["leech"]["confusable"] is None


def test_a_word_with_the_same_translation_is_not_confusable(db):
    _seed(db, other_translation="japan")
    _history(db, "voc_V1", LEECH_LAPSES)
    assert _annotate(_cards())[0]["leech"]["confusable"] is None


def test_the_note_is_personal_to_the_score_and_comes_back_with_the_card(db):
    _seed(db)
    ScoreService().set_note("user_U1", "voc_V1", "sun + root = Japan")
    merged = ScoreService().merge("user_U1", [{"id": "voc_V1"}, {"id": "voc_V9"}])
    assert merged[0]["note"] == "sun + root = Japan" and merged[1]["note"] is None
    ScoreService().set_note("user_U1", "voc_V1", "")
    assert ScoreService().merge("user_U1", [{"id": "voc_V1"}])[0]["note"] in (None, "")


def _client(app, uid="user_U1"):
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def test_note_route_saves_and_validates(app, db):
    _seed(db)
    c = _client(app)
    assert c.put("/api/review/note/voc_V1", json={"note": "mnemonic"}).status_code == 200
    assert ScoreService().merge("user_U1", [{"id": "voc_V1"}])[0]["note"] == "mnemonic"
    assert c.put("/api/review/note/voc_V1", json={"note": "x" * 501}).status_code == 400
    assert c.put("/api/review/note/voc_V1", json={"note": 5}).status_code == 400
    assert c.put("/api/review/note/voc_NOPE", json={"note": "x"}).status_code == 404
