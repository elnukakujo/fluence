"""The exercise share of the daily review rises with knowledge; exercises on barely-seen elements are held back."""
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Exercise, Vocabulary
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services import ReviewService
from lapp.services.system_data import ScoreService, UserPreferencesService


def _seed(db, vocab_score, n=12, minutes=2, layout=None, unseen=0):
    """n vocabularies, each with a ready translate exercise linked to it; `unseen` more pairs with no score."""
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for i in range(n + unseen):
            db.insert(Word(id=f"word_{i}", language_id="lang_L1", word=f"w{i}"), session=s, commit=False)
            voc = Vocabulary(id=f"voc_{i}", lesson_id="lesson_L1", word_id=f"word_{i}")
            db.insert(voc, session=s, commit=False)
            ex = Exercise(id=f"ex_{i}", lesson_id="lesson_L1", exercise_type="translate", question=f"say {i}", answer="ok")
            ex.related_vocabulary.append(voc)
            db.insert(ex, session=s, commit=False)
    for i in range(n):
        ScoreService().set("user_U1", f"voc_{i}", vocab_score, 0.5)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", daily_goal_minutes=minutes, review_layout=layout))


def _queue():
    return [c["id"] for c in ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True) if not c["spare"]]


def _exercises(ids): return [i for i in ids if i.startswith("ex_")]


def test_low_knowledge_gives_few_exercises(db):
    _seed(db, 25, n=40, minutes=5)
    assert len(_exercises(_queue())) <= 13      # share ~0.22 of 300 s at ~6 s each


def test_high_knowledge_gives_many_exercises(db):
    _seed(db, 80, n=40, minutes=5)
    assert len(_exercises(_queue())) >= 24      # share 0.5 of 300 s at ~6 s each


def test_exercise_on_unseen_elements_never_appears(db):
    _seed(db, 50, n=4, unseen=4)
    ex = _exercises(_queue())
    assert ex and not {f"ex_{i}" for i in range(4, 8)} & set(ex)


def test_menu_exercise_minutes_still_win(db):
    _seed(db, 50, layout=[{"type": "voc", "minutes": 1}, {"type": "ex", "minutes": 1}])
    assert _exercises(_queue())


def test_no_eligible_exercise_leaves_flashcards_only(db):
    _seed(db, 5)
    ids = _queue()
    assert ids and not _exercises(ids)
