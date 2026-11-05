from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.components import Word, Character
from ...models.containers import Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy
from ...models.system_data import StudyGoal, StudyGoalItem, Score
from ...utils import review_priority
from ...models.system_data import UserPreferences
from .study_constants import GOAL_MASTERED_SCORE, DEFAULT_GOAL_PERIOD, default_goal_quantities

PERIOD_DAYS = {"week": 7, "biweek": 14, "month": 30}
# goal type -> (element model, "new" quantity column, "review" quantity column)
TYPES = {
    "vocabulary": (Vocabulary, "n_vocabulary", "r_vocabulary"),
    "grammar": (Grammar, "n_grammar", "r_grammar"),
    "calligraphy": (Calligraphy, "n_calligraphy", "r_calligraphy"),
}
_PREFIX_TYPE = {"voc_": "vocabulary", "gram_": "grammar", "call_": "calligraphy"}
SIDES = ("front", "back")


def _cycle_start(goal: StudyGoal, today: date) -> date:
    """The period (on the grid anchored at the goal's start date) that contains today. Only used to adopt
    a goal that has no locked menu yet; after that periods follow each other from the locked one."""
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
               n_calligraphy: int, active: bool = True, r_vocabulary: int = 0, r_grammar: int = 0,
               r_calligraphy: int = 0, auto: bool = False, today: Optional[date] = None,
               session: Optional[Session] = None) -> dict:
        """Save the goal. The quantities and the period are what the NEXT period will use: the running
        period's menu stays locked (see `ensure_cycle`). `active` takes effect at once. With `auto` the
        quantities are the suggested ones for the user's daily minutes (and keep following them); a save
        with `auto` False makes the numbers the user's own."""
        if auto:
            wanted = default_goal_quantities(self._daily_minutes(user_id, session))
            n_vocabulary, n_grammar, n_calligraphy = (wanted["n"][k] for k in TYPES)
            r_vocabulary, r_grammar, r_calligraphy = (wanted["r"][k] for k in TYPES)
        if period not in PERIOD_DAYS:
            raise ValueError(f"period must be one of {tuple(PERIOD_DAYS)}")
        counts = (n_vocabulary, n_grammar, n_calligraphy, r_vocabulary, r_grammar, r_calligraphy)
        if any(not isinstance(n, int) or isinstance(n, bool) or n < 0 for n in counts):
            raise ValueError("quantities must be non-negative integers")
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            goal = StudyGoal(id=db_manager.generate_new_id(StudyGoal, session=session), user_id=user_id,
                             language_id=language_id, start_date=today or date.today(), period=period)
            session.add(goal)
        was_suggested = goal.auto and not auto and goal.locked is not None
        goal.period, goal.active, goal.auto = period, bool(active), bool(auto)
        goal.n_vocabulary, goal.n_grammar, goal.n_calligraphy, goal.r_vocabulary, goal.r_grammar, goal.r_calligraphy = counts
        if was_suggested:            # first time the user sets their own numbers: replace the suggested menu at once
            self._reset(goal, today or date.today(), session)
        session.flush()
        return self._dict(goal)

    @transactional
    def reset(self, user_id: str, language_id: str, today: Optional[date] = None,
              session: Optional[Session] = None) -> Optional[dict]:
        """Unlock the running period: drop its menu and the carried-over picks and start a new period today, built
        from the goal's current quantities on the next read."""
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            return None
        self._reset(goal, today or date.today(), session)
        session.flush()
        return self._dict(goal)

    @staticmethod
    def _reset(goal: StudyGoal, today: date, session) -> None:
        session.query(StudyGoalItem).filter_by(goal_id=goal.id).delete()
        goal.locked, goal.start_date = None, today

    @transactional
    def ensure_default(self, user_id: str, language_id: str, session: Optional[Session] = None) -> Optional[dict]:
        """The goal of a language; a user who has none gets the suggested one for their daily minutes
        (a weekly goal that follows those minutes), so the app works without opening Settings."""
        if self._goal(user_id, language_id, session) is None and self._preferences(user_id, session) is not None:
            return self.upsert(user_id, language_id, DEFAULT_GOAL_PERIOD, 0, 0, 0, True, auto=True, session=session)
        return self.get(user_id, language_id, session=session)

    @transactional
    def suggested(self, user_id: str, session: Optional[Session] = None) -> dict:
        """The suggested quantities for the user's daily minutes: {"n": {type: n}, "r": {type: r}}."""
        return default_goal_quantities(self._daily_minutes(user_id, session))

    @transactional
    def refresh_auto_goals(self, user_id: str, session: Optional[Session] = None) -> None:
        """The daily minutes changed: goals still on the suggested quantities follow them (from the next period)."""
        wanted = default_goal_quantities(self._daily_minutes(user_id, session))
        for goal in session.query(StudyGoal).filter_by(user_id=user_id, auto=True).all():
            for kind, (_m, n_col, r_col) in TYPES.items():
                setattr(goal, n_col, wanted["n"][kind])
                setattr(goal, r_col, wanted["r"][kind])
        session.flush()

    @transactional
    def ensure_cycle(self, user_id: str, language_id: str, today: Optional[date] = None,
                     session: Optional[Session] = None) -> list[StudyGoalItem]:
        """Make sure the running period has its menu, and return the open items of the menu.

        The menu is locked for the whole period: at its start the goal's quantities are frozen and, per type,
        N unstarted elements ("new", lesson order) and R already-seen ones ("review", highest review priority)
        are picked. Nothing is added, removed or resized until the period ends; only slots that could not be
        filled (not enough matching elements) are filled later, up to the frozen quantity.

        Open = a new element not yet mastered (those of earlier periods carry over) or a review element not
        yet reviewed this period."""
        today = today or date.today()
        goal = self._goal(user_id, language_id, session)
        if goal is None or not goal.active:
            return []
        self._drop_gone(goal, language_id, session)
        lock = self._lock(goal, today, session)
        start = lock["start"]
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        everything = {i.element_id for i in items}
        this_period = {i.element_id for i in items if i.cycle_start == start}
        older_new = [i.element_id for i in items if i.cycle_start != start and i.kind == "new"]
        older_scores = self._scores(user_id, older_new, session)
        carried_open = {e for e in older_new if older_scores.get(e, 0.0) < GOAL_MASTERED_SCORE}   # already served as new
        for kind, (model, _n, _r) in TYPES.items():
            mine = [i for i in items if i.cycle_start == start and _type_of(i.element_id) == kind]
            for role, quota, pick in (("new", lock["n"][kind], self._new_elements), ("review", lock["r"][kind], self._review_elements)):
                missing = quota - sum(1 for i in mine if i.kind == role)
                if missing <= 0:
                    continue
                # new elements never repeat an earlier pick; a review element only has to be off this period's menu
                for element_id in pick(model, language_id, user_id, everything if role == "new" else this_period | carried_open, missing, session):
                    session.add(StudyGoalItem(id=db_manager.generate_new_id(StudyGoalItem, session=session), goal_id=goal.id,
                                              element_id=element_id, cycle_start=start, kind=role))
                    everything.add(element_id)
                    this_period.add(element_id)
        session.flush()
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        return self._open(items, user_id, start, session)

    @transactional
    def locked_kinds(self, user_id: str, language_id: str, today: Optional[date] = None,
                     session: Optional[Session] = None) -> set[str]:
        """The element types the running period's menu covers (an active goal with new or review slots for them)."""
        goal = self._goal(user_id, language_id, session)
        if goal is None or not goal.active:
            return set()
        lock = self._lock(goal, today or date.today(), session)
        return {k for k in TYPES if lock["n"][k] + lock["r"][k] > 0}

    @transactional
    def progress(self, user_id: str, language_id: str, today: Optional[date] = None,
                 session: Optional[Session] = None) -> Optional[dict]:
        today = today or date.today()
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            return None
        self.ensure_cycle(user_id, language_id, today=today, session=session)
        lock = self._lock(goal, today, session)
        start, end = lock["start"], lock["end"]
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        done = self._done(items, user_id, start, session)
        types = {k: {"n": lock["n"][k], "picked": 0, "mastered": 0, "carried": 0,
                     "r": lock["r"][k], "review_picked": 0, "review_done": 0} for k in TYPES}
        listed = []
        for i in items:
            kind = _type_of(i.element_id)
            row, finished = types[kind], i.element_id in done
            current = i.cycle_start == start
            if not current and (i.kind != "new" or finished):
                continue                                     # old periods only carry unfinished new elements
            if current and i.kind == "new":
                row["picked"] += 1
                row["mastered"] += int(finished)
            elif current:
                row["review_picked"] += 1
                row["review_done"] += int(finished)
            else:
                row["carried"] += 1
            label, lesson_id = self._describe(i.element_id, session)
            listed.append({"id": i.element_id, "kind": kind, "role": i.kind, "label": label, "lesson_id": lesson_id,
                           "done": finished, "carried": not current})
        pending = (goal.period != lock["period"]
                   or any(getattr(goal, TYPES[k][1]) != lock["n"][k] or getattr(goal, TYPES[k][2]) != lock["r"][k] for k in TYPES))
        return {"period": lock["period"], "active": goal.active, "cycle_start": start.isoformat(), "cycle_end": end.isoformat(),
                "types": types, "items": listed,
                "next": {"start": end.isoformat(), "period": goal.period, "pending": pending,
                         "n": {k: getattr(goal, TYPES[k][1]) for k in TYPES}, "r": {k: getattr(goal, TYPES[k][2]) for k in TYPES}}}

    # -- lock ----------------------------------------------------------------------------------
    @staticmethod
    def _parsed(locked: Optional[dict]) -> Optional[dict]:
        if not locked:
            return None
        start = date.fromisoformat(locked["start"])
        return {**locked, "start": start, "end": start + timedelta(days=PERIOD_DAYS[locked["period"]])}

    def _lock(self, goal: StudyGoal, today: date, session) -> dict:
        """The running period's frozen menu settings; freezes the goal's current ones when a period starts."""
        current = self._parsed(goal.locked)
        if current and today < current["end"]:
            return current
        length = PERIOD_DAYS[goal.period]
        start = (current["end"] + timedelta(days=((today - current["end"]).days // length) * length)
                 if current else _cycle_start(goal, today))
        goal.locked = {"start": start.isoformat(), "period": goal.period,
                       "n": {k: getattr(goal, c[1]) for k, c in TYPES.items()},
                       "r": {k: getattr(goal, c[2]) for k, c in TYPES.items()}}
        session.flush()
        return self._parsed(goal.locked)

    # -- helpers -------------------------------------------------------------------------------
    @staticmethod
    def _preferences(user_id, session) -> Optional[UserPreferences]:
        return session.query(UserPreferences).filter_by(user_id=user_id).first()

    def _daily_minutes(self, user_id, session) -> int:
        prefs = self._preferences(user_id, session)
        return (prefs.daily_goal_minutes if prefs and prefs.daily_goal_minutes else 20)

    @staticmethod
    def _goal(user_id, language_id, session) -> Optional[StudyGoal]:
        return session.query(StudyGoal).filter_by(user_id=user_id, language_id=language_id).first()

    @staticmethod
    def _dict(goal: StudyGoal) -> dict:
        return {"id": goal.id, "language_id": goal.language_id, "period": goal.period,
                "start_date": goal.start_date.isoformat(), "n_vocabulary": goal.n_vocabulary,
                "n_grammar": goal.n_grammar, "n_calligraphy": goal.n_calligraphy,
                "r_vocabulary": goal.r_vocabulary, "r_grammar": goal.r_grammar, "r_calligraphy": goal.r_calligraphy,
                "active": goal.active, "auto": goal.auto}

    @staticmethod
    def _describe(element_id: str, session) -> tuple[str, Optional[str]]:
        """(what the learner recognises the element by, its lesson): the word, the grammar title or the character."""
        kind = _type_of(element_id)
        row = session.get(TYPES[kind][0], element_id)
        if row is None:
            return element_id, None
        if kind == "vocabulary":
            word = session.get(Word, row.word_id)
            return (word.word if word else element_id), row.lesson_id
        if kind == "grammar":
            return row.title, row.lesson_id
        character = session.get(Character, row.character_id)
        return (character.character if character else element_id), row.lesson_id

    @staticmethod
    def _scores(user_id, element_ids, session) -> dict[str, float]:
        if not element_ids:
            return {}
        rows = session.query(Score).filter(Score.user_id == user_id, Score.element_id.in_(element_ids)).all()
        return {r.element_id: r.score for r in rows}

    def _done(self, items, user_id, start: date, session) -> set[str]:
        """Finished elements: a new one once mastered, a review one once reviewed in this period (both sides for vocabulary)."""
        new_ids = [i.element_id for i in items if i.kind == "new"]
        review_ids = [i.element_id for i in items if i.kind == "review"]
        scores = self._scores(user_id, new_ids, session)
        finished = {e for e in new_ids if scores.get(e, 0.0) >= GOAL_MASTERED_SCORE}
        since = datetime.combine(start, time.min)
        sides = {e: ([f"{e}#{s}" for s in SIDES] if _type_of(e) == "vocabulary" else [e]) for e in review_ids}
        rows = session.query(Score.element_id, Score.last_seen_at).filter(
            Score.user_id == user_id, Score.element_id.in_([x for v in sides.values() for x in v])).all() if review_ids else []
        seen = {element_id: last for element_id, last in rows}
        finished |= {e for e, ids in sides.items() if all((seen.get(x) or datetime.min) >= since for x in ids)}
        return finished

    def _open(self, items, user_id, start: date, session) -> list[StudyGoalItem]:
        done = self._done(items, user_id, start, session)
        return [i for i in items if i.element_id not in done and (i.cycle_start == start or i.kind == "new")]

    @staticmethod
    def _drop_gone(goal, language_id, session) -> None:
        """Forget picked elements that were deleted or moved out of the language (no replacement: the menu is locked)."""
        for i in session.query(StudyGoalItem).filter_by(goal_id=goal.id).all():
            model = TYPES[_type_of(i.element_id)][0]
            row = session.get(model, i.element_id)
            lesson = session.get(Lesson, row.lesson_id) if row else None
            if lesson is None or lesson.language_id != language_id:
                session.delete(i)
        session.flush()

    @staticmethod
    def _language_elements(model, language_id, session) -> list[str]:
        rows = (session.query(model.id).join(Lesson, Lesson.id == model.lesson_id)
                .filter(Lesson.language_id == language_id)
                .order_by(Lesson.position, Lesson.created_at, model.created_at, model.id).all())
        return [r[0] for r in rows]

    @staticmethod
    def _new_elements(model, language_id, user_id, taken, n, session) -> list[str]:
        """Up to n unstarted element ids (no Score row, or score 0) in lesson order, then creation order."""
        ids = [i for i in StudyGoalService._language_elements(model, language_id, session) if i not in taken]
        scores = StudyGoalService._scores(user_id, ids, session)
        return [i for i in ids if scores.get(i, 0.0) == 0.0][:n]

    @staticmethod
    def _review_elements(model, language_id, user_id, taken, n, session) -> list[str]:
        """Up to n already-seen element ids (they have a Score row), the ones most due first (`review_priority`)."""
        ids = [i for i in StudyGoalService._language_elements(model, language_id, session) if i not in taken]
        if not ids:
            return []
        rows = session.query(Score).filter(Score.user_id == user_id, Score.element_id.in_(ids)).all()
        rows.sort(key=lambda r: review_priority(r.created_at, r.last_seen_at or r.created_at, r.difficulty or 0.0, r.score or 0), reverse=True)
        return [r.element_id for r in rows][:n]
