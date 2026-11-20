"""The exercise share of the daily review rises with knowledge; an exercise waits until its elements were seen once (RD-129)."""
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.components import Word
from lapp.models.features import Exercise, Vocabulary
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services import ReviewService
from lapp.services.system_data import ScoreService, UserPreferencesService


def _seed(db, vocab_score, n=12, cards=20, layout=None, unseen=0):
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
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", reviews_per_day=cards, review_layout=layout))


def _queue():
    return [c["id"] for c in ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True) if not c["spare"]]


def _exercises(ids): return [i for i in ids if i.startswith("ex_")]


def test_low_knowledge_gives_few_exercises(db):
    _seed(db, 25, n=40, cards=50)
    assert len(_exercises(_queue())) <= 13      # share ~0.22 of 50 cards


def test_high_knowledge_gives_many_exercises(db):
    _seed(db, 80, n=40, cards=50)
    assert len(_exercises(_queue())) >= 24      # share 0.5 of 50 cards


def test_exercise_on_unseen_elements_never_appears(db):
    _seed(db, 50, n=4, unseen=4)
    ex = _exercises(_queue())
    assert ex and not {f"ex_{i}" for i in range(4, 8)} & set(ex)


def test_menu_exercise_counts_still_win(db):
    _seed(db, 50, layout=[{"type": "voc", "count": 1}, {"type": "ex", "count": 1}])
    assert _exercises(_queue())


def test_no_eligible_exercise_leaves_flashcards_only(db):
    _seed(db, 0, n=0, unseen=4)          # nothing seen yet: no exercise
    assert not _exercises(_queue())


def test_a_barely_known_but_seen_element_gets_its_exercise(db):
    _seed(db, 5)                         # score 5, well under the old threshold of 20
    assert _exercises(_queue())


def test_a_plan_without_exercises_still_gets_some(db):
    _seed(db, 50, layout=[{"type": "voc", "count": None}])
    assert _exercises(_queue())
