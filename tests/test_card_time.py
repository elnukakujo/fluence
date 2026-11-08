"""Per-card time estimates: content prior, measured pace, blend."""
from types import SimpleNamespace as NS

from lapp.services.features.study_constants import AUDIO_SECONDS, EXERCISE_TIME, READ_CHARS_PER_S, VOC_SECONDS, CALL_SECONDS
from lapp.services.features.card_time import card_key, estimate_seconds, pace_ratios, prior_seconds
from lapp.services.features.study_constants import PACE_MAX_FACTOR


def ex(type_="translate", question="Translate this short sentence into French please", answer="Traduis cette phrase", text_support="", content=None, audio_files=()):
    return NS(exercise_type=type_, question=question, answer=answer, text_support=text_support, content=content, audio_files=list(audio_files))


def test_one_sentence_exercise_is_short():
    assert 8 <= prior_seconds(ex()) <= 25


def test_types_differ():
    assert prior_seconds(ex("true_false")) < prior_seconds(ex("essay"))


def test_text_support_adds_time():
    long = ex(text_support="漢" * 600)
    assert prior_seconds(long) - prior_seconds(ex()) >= 600 / READ_CHARS_PER_S - 1


def test_audio_adds_time():
    assert prior_seconds(ex(audio_files=["a", "b"])) - prior_seconds(ex()) == 2 * AUDIO_SECONDS
    lines = {"lines": [{"text": "a"}, {"text": "b"}, {"text": "c"}]}
    assert prior_seconds(ex("dictation", content=lines)) - prior_seconds(ex("dictation")) >= 3 * AUDIO_SECONDS


def test_empty_exercise_is_type_base():
    e = ex("true_false", question="", answer="", text_support="", content=None)
    assert prior_seconds(e) == EXERCISE_TIME["true_false"]["base"]
    assert prior_seconds(ex("never_seen", question="", answer="", text_support=None)) > 0


class Grammar:
    def __init__(self, explanation): self.title, self.explanation = "t", explanation


def test_grammar_grows_with_sheet():
    assert prior_seconds(Grammar("word " * 400)) > prior_seconds(Grammar("word " * 10))


def test_vocabulary_and_calligraphy_flat():
    assert prior_seconds(type("Vocabulary", (), {})()) == VOC_SECONDS
    assert prior_seconds(type("Calligraphy", (), {})()) == CALL_SECONDS
    assert card_key(ex("quizz")) == "quizz" and card_key(type("Vocabulary", (), {})()) == "voc"


def _seed(db, rows):
    from lapp.models.system_data import User
    from lapp.models.containers import Language, Lesson
    from lapp.models.features import Exercise
    from lapp.models.data_collection import ProgressTracking
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for t in ("translate", "true_false"):
            db.insert(Exercise(id=f"ex_{t}", lesson_id="lesson_L1", exercise_type=t, question="a short question here", answer="short"), session=s, commit=False)
        for i, (eid, ms) in enumerate(rows):
            db.insert(ProgressTracking(id=f"prog_{i}", user_id="user_U1", language_id="lang_L1", element_type="exercise", element_id=eid,
                                       element_status="reviewed", score_before=0, score_after=1, result=True, duration_ms=ms), session=s, commit=False)


def test_no_history_is_prior():
    e = ex()
    assert estimate_seconds(e, {}) == prior_seconds(e)


def test_blend_weight():
    e = ex()
    assert abs(estimate_seconds(e, {"translate": (0.5, 5)}) - prior_seconds(e) * 0.75) < 1e-9


def test_pace_per_type_clamped_and_windowed(db):
    _seed(db, [("ex_translate", 1200000), ("ex_translate", 100)] + [("ex_true_false", 5000)] * 25)
    with db.session_scope() as s:
        paces = pace_ratios("user_U1", s)
        tr = s.get(__import__("lapp.models.features", fromlist=["Exercise"]).Exercise, "ex_translate")
        prior = prior_seconds(tr)
    assert paces["translate"][1] == 2 and paces["true_false"][1] == 20
    assert paces["translate"][0] <= (PACE_MAX_FACTOR + 2 / prior) / 2 + 1e-9      # idle row capped at 5x, fast row floored at 2 s
