from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.containers import Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy
from ...models.system_data import StudyGoal, StudyGoalItem, Score
from .study_constants import GOAL_MASTERED_SCORE

PERIOD_DAYS = {"week": 7, "biweek": 14, "month": 30}
# goal type -> (element model, quantity column on StudyGoal)
TYPES = {
    "vocabulary": (Vocabulary, "n_vocabulary"),
    "grammar": (Grammar, "n_grammar"),
    "calligraphy": (Calligraphy, "n_calligraphy"),
}
_PREFIX_TYPE = {"voc_": "vocabulary", "gram_": "grammar", "call_": "calligraphy"}


def _cycle_start(goal: StudyGoal, today: date) -> date:
    length = PERIOD_DAYS[goal.period]
    return goal.start_date + timedelta(days=((today - goal.start_date).days // length) * length)


def _type_of(element_id: str) -> Optional[str]:
    return next((t for p, t in _PREFIX_TYPE.items() if element_id.startswith(p)), None)


class StudyGoalService:
    @transactional
    def get(self, user_id: str, language_id: str, session: Optional[Session] = None) -> Optional[dict]:
        goal = self._goal(user_id, language_id, session)
        return None if goal is None else self._dict(goal)

    @transactional
    def upsert(self, user_id: str, language_id: str, period: str, n_vocabulary: int, n_grammar: int,
               n_calligraphy: int, active: bool = True, today: Optional[date] = None,
               session: Optional[Session] = None) -> dict:
        if period not in PERIOD_DAYS:
            raise ValueError(f"period must be one of {tuple(PERIOD_DAYS)}")
        counts = (n_vocabulary, n_grammar, n_calligraphy)
        if any(not isinstance(n, int) or isinstance(n, bool) or n < 0 for n in counts):
            raise ValueError("quantities must be non-negative integers")
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            goal = StudyGoal(id=db_manager.generate_new_id(StudyGoal, session=session), user_id=user_id,
                             language_id=language_id, start_date=today or date.today(), period=period)
            session.add(goal)
        goal.period, goal.active = period, bool(active)
        goal.n_vocabulary, goal.n_grammar, goal.n_calligraphy = counts
        session.flush()
        return self._dict(goal)

    @transactional
    def ensure_cycle(self, user_id: str, language_id: str, today: Optional[date] = None, force: bool = False,
                     session: Optional[Session] = None) -> list[StudyGoalItem]:
        """Start the current cycle if it has no picks yet (`force`: top it up now) and return the
        goal's open items: every picked element not yet mastered, carried-over ones included."""
        today = today or date.today()
        goal = self._goal(user_id, language_id, session)
        if goal is None or not goal.active:
            return []
        self._drop_gone(goal, language_id, session)
        start = _cycle_start(goal, today)
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        if force or not any(i.cycle_start == start for i in items):
            taken = {i.element_id for i in items}
            for kind, (model, col) in TYPES.items():
                for element_id in self._new_elements(model, language_id, user_id, taken, getattr(goal, col), session):
                    session.add(StudyGoalItem(id=db_manager.generate_new_id(StudyGoalItem, session=session),
                                              goal_id=goal.id, element_id=element_id, cycle_start=start))
                    taken.add(element_id)
            session.flush()
            items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        scores = self._scores(user_id, [i.element_id for i in items], session)
        return [i for i in items if scores.get(i.element_id, 0.0) < GOAL_MASTERED_SCORE]

    @transactional
    def progress(self, user_id: str, language_id: str, today: Optional[date] = None,
                 session: Optional[Session] = None) -> Optional[dict]:
        today = today or date.today()
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            return None
        self.ensure_cycle(user_id, language_id, today=today, session=session)
        start = _cycle_start(goal, today)
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        scores = self._scores(user_id, [i.element_id for i in items], session)
        types = {k: {"n": getattr(goal, col), "picked": 0, "mastered": 0, "carried": 0} for k, (_, col) in TYPES.items()}
        for i in items:
            row, mastered = types[_type_of(i.element_id)], scores.get(i.element_id, 0.0) >= GOAL_MASTERED_SCORE
            if i.cycle_start == start:
                row["picked"] += 1
                row["mastered"] += int(mastered)
            elif not mastered:
                row["carried"] += 1
        return {"period": goal.period, "active": goal.active, "cycle_start": start.isoformat(),
                "cycle_end": (start + timedelta(days=PERIOD_DAYS[goal.period])).isoformat(), "types": types}

    # -- helpers ------------------------------------------------------------------------------
    @staticmethod
    def _goal(user_id, language_id, session) -> Optional[StudyGoal]:
        return session.query(StudyGoal).filter_by(user_id=user_id, language_id=language_id).first()

    @staticmethod
    def _dict(goal: StudyGoal) -> dict:
        return {"id": goal.id, "language_id": goal.language_id, "period": goal.period,
                "start_date": goal.start_date.isoformat(), "n_vocabulary": goal.n_vocabulary,
                "n_grammar": goal.n_grammar, "n_calligraphy": goal.n_calligraphy, "active": goal.active}

    @staticmethod
    def _scores(user_id, element_ids, session) -> dict[str, float]:
        if not element_ids:
            return {}
        rows = session.query(Score).filter(Score.user_id == user_id, Score.element_id.in_(element_ids)).all()
        return {r.element_id: r.score for r in rows}

    @staticmethod
    def _drop_gone(goal, language_id, session) -> None:
        """Forget picked elements that were deleted or moved out of the language."""
        for i in session.query(StudyGoalItem).filter_by(goal_id=goal.id).all():
            model = TYPES[_type_of(i.element_id)][0]
            row = session.get(model, i.element_id)
            lesson = session.get(Lesson, row.lesson_id) if row else None
            if lesson is None or lesson.language_id != language_id:
                session.delete(i)
        session.flush()

    @staticmethod
    def _new_elements(model, language_id, user_id, taken, n, session) -> list[str]:
        """Up to n unstarted element ids (no Score row, or score 0) in lesson order, then creation order."""
        if n <= 0:
            return []
        rows = (session.query(model.id).join(Lesson, Lesson.id == model.lesson_id)
                .filter(Lesson.language_id == language_id)
                .order_by(Lesson.position, Lesson.created_at, model.created_at, model.id).all())
        ids = [r[0] for r in rows if r[0] not in taken]
        scores = StudyGoalService._scores(user_id, ids, session)
        return [i for i in ids if scores.get(i, 0.0) == 0.0][:n]
