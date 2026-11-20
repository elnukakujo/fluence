"""DR-13: a grammar's reading card is for the unseen; once seen, its exercises replace it (a seen grammar without exercises keeps its card)."""
from lapp.models.system_data import User
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise, Grammar
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services import ReviewService
from lapp.services.system_data import ScoreService, UserPreferencesService


def _seed(db):
    """gram_G1 unseen with an exercise, gram_G2 seen with an exercise, gram_G3 seen without, gram_G4 seen with an exercise linked to nothing else."""
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(Language(id="lang_L1", user_id="user_U1", name="J", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L", position=0), session=s, commit=False)
        for n in (1, 2, 3):
            db.insert(Grammar(id=f"gram_G{n}", lesson_id="lesson_L1", title=f"G{n}", explanation="x"), session=s, commit=False)
        for n in (1, 2):
            ex = Exercise(id=f"ex_E{n}", lesson_id="lesson_L1", exercise_type="translate", question=f"say {n}", answer="ok")
            ex.related_grammar.append(s.get(Grammar, f"gram_G{n}"))
            db.insert(ex, session=s, commit=False)
    for n in (2, 3):
        ScoreService().set("user_U1", f"gram_G{n}", 30, 0.5)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", reviews_per_day=40))


def _ids(db, **kw):
    return [c["id"] for c in ReviewService().get_review_cards(language_id="lang_L1", user_id="user_U1", as_dict=True) if not c["spare"]]


def test_a_seen_grammar_with_exercises_leaves_the_daily_queue(db):
    _seed(db)
    ids = _ids(db)
    assert "gram_G1" in ids          # unseen: its card is offered
    assert "gram_G2" not in ids      # seen and has an exercise: replaced
    assert "gram_G3" in ids          # seen, no exercise: keeps its card
    assert {"ex_E1", "ex_E2"} & set(ids)
