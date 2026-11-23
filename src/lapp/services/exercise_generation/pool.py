"""The elements an exercise batch can be about: a lesson's own, topped up from other lessons when it is thin."""
from sqlalchemy.orm import Session

from ...models.features import Calligraphy, Grammar, Vocabulary
from ..features.study_constants import GEN_ADVANCED_FROM, GEN_KNOWN_SCORE, GEN_THIN_POOL
from ..features.studied_types import studied_types
from ..system_data import ScoreService
from .planner import PoolItem

_KINDS = ((Vocabulary, "vocabulary", lambda e: e.word.word), (Grammar, "grammar", lambda e: e.title),
          (Calligraphy, "calligraphy", lambda e: e.character.character))


def lesson_pool(lesson_id: str, user_id: str, session: Session) -> list[PoolItem]:
    from ...models.containers import Lesson
    lesson = session.get(Lesson, lesson_id)
    studied = studied_types(user_id, lesson.language_id, session=session)       # SG-14: a type that is off gives no slot and no companion
    kinds = [(m, k, label) for m, k, label in _KINDS if k in studied]
    own = [(m, k, label(e), e) for m, k, label in kinds for e in session.query(m).filter(m.lesson_id == lesson_id).all()]
    lesson_ids = {e.id for *_, e in own}      # what the lesson itself holds; borrowed elements never anchor an exercise (EG-15)
    if own and len(own) < GEN_THIN_POOL:
        taken = {e.id for *_, e in own}
        for m, k, label in kinds:
            rows = (session.query(m).join(Lesson, m.lesson_id == Lesson.id)
                    .filter(Lesson.language_id == lesson.language_id, m.lesson_id != lesson_id, Lesson.level == lesson.level).all())
            own += [(m, k, label(e), e) for e in rows if e.id not in taken]
    scores = ScoreService().get_many(user_id, [e.id for *_, e in own], session=session)
    return [PoolItem(k, e.id, text, scores[e.id].score if e.id in scores else 0.0, e.id in lesson_ids) for _, k, text, e in own]


def known_words(lesson_id: str, user_id: str, session: Session) -> list[str]:
    """The words of the whole language the user knows well (score >= GEN_KNOWN_SCORE): what exercises may lean on."""
    from ...models.containers import Lesson
    lesson = session.get(Lesson, lesson_id)
    rows = (session.query(Vocabulary).join(Lesson, Vocabulary.lesson_id == Lesson.id).filter(Lesson.language_id == lesson.language_id).all())
    scores = ScoreService().get_many(user_id, [e.id for e in rows], session=session)
    return [e.word.word for e in rows if e.id in scores and scores[e.id].score >= GEN_KNOWN_SCORE and e.word.word]


def is_advanced(known: list[str]) -> bool:
    """Enough known words for free writing and conversation; below that the learner is a beginner."""
    return len(known) >= GEN_ADVANCED_FROM
