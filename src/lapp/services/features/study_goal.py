from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.components import Word, Character
from ...models.containers import Lesson
from ...models.features import Vocabulary, Grammar, Calligraphy
from ...models.system_data import StudyGoal, StudyGoalItem, Score
from ...utils import review_priority
from ...utils.learner_clock import learner_today
from ..system_data.prefs_view import prefs_for
from ...models.system_data import UserPreferences
from ...utils.scoring import KNOWN_FROM
from ..system_data import ScoreService
from .lesson_gate import GateService
from ..system_data.settings import resolve
from .study_constants import DEFAULT_GOAL_PERIOD, default_goal_quantities

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
    @staticmethod
    def _today(user_id: str, session) -> date:
        """The learner's own calendar day (their stored time zone), never the server's."""
        return learner_today(prefs_for(user_id, None, session).timezone)

    @transactional
    def get(self, user_id: str, language_id: str, session: Optional[Session] = None) -> Optional[dict]:
        goal = self._goal(user_id, language_id, session)
        if goal is not None:
            self._hide_unstudied(goal, user_id, session)
        return None if goal is None else self._dict(goal)

    @transactional
    def upsert(self, user_id: str, language_id: str, period: str, n_vocabulary: int, n_grammar: int,
               n_calligraphy: int, active: bool = True, r_vocabulary: int = 0, r_grammar: int = 0,
               r_calligraphy: int = 0, auto: bool = False, today: Optional[date] = None,
               session: Optional[Session] = None) -> dict:
        """Save the goal. The quantities and the period are what the NEXT period will use: the running
        period's menu stays locked (see `ensure_cycle`). `active` takes effect at once. With `auto` the
        quantities are the suggested ones for the user's new per week and reviews per day (and keep following them); a save
        with `auto` False makes the numbers the user's own."""
        if auto:
            wanted = self._suggested(user_id, period, session, language_id)
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
                             language_id=language_id, start_date=today or self._today(user_id, session), period=period)
            session.add(goal)
        was_suggested = goal.auto and not auto and goal.locked is not None
        goal.period, goal.active, goal.auto = period, bool(active), bool(auto)
        (goal.n_vocabulary, goal.n_grammar, goal.n_calligraphy, goal.r_vocabulary, goal.r_grammar, goal.r_calligraphy) = counts
        if was_suggested:            # first time the user sets their own numbers: replace the suggested menu at once
            self._reset(goal, today or self._today(user_id, session), session)
        self._hide_unstudied(goal, user_id, session)
        return self._dict(goal)

    @transactional
    def reset(self, user_id: str, language_id: str, today: Optional[date] = None, keep_mastered: bool = True,
              session: Optional[Session] = None) -> Optional[dict]:
        """Rebuild the menu from the goal's current quantities. With `keep_mastered`, the running period stays and
        only its unfinished picks (and carried ones) are redrawn; the mastered / reviewed ones keep their slot.
        Without anything finished (or without `keep_mastered`) the period restarts today with a fresh menu."""
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            return None
        today = today or self._today(user_id, session)
        if keep_mastered and goal.active and goal.locked:
            lock = self._lock(goal, today, session)
            items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
            done = self._done(items, user_id, session)
            if done:
                for i in items:
                    if i.id not in done:
                        session.delete(i)
                goal.locked = {**goal.locked, "n": {k: getattr(goal, c[1]) for k, c in TYPES.items()},
                               "r": {k: getattr(goal, c[2]) for k, c in TYPES.items()}}
                session.flush()
                return self._dict(goal)
        self._reset(goal, today, session)
        session.flush()
        return self._dict(goal)

    @staticmethod
    def _reset(goal: StudyGoal, today: date, session) -> None:
        session.query(StudyGoalItem).filter_by(goal_id=goal.id).delete()
        goal.locked, goal.start_date = None, today

    @transactional
    def ensure_default(self, user_id: str, language_id: str, session: Optional[Session] = None) -> Optional[dict]:
        """The goal of a language; a user who has none gets the suggested one for their new per week and
        reviews per day (a weekly goal that follows them), so the app works without opening Settings."""
        if self._goal(user_id, language_id, session) is None and self._preferences(user_id, session) is not None:
            return self.upsert(user_id, language_id, DEFAULT_GOAL_PERIOD, 0, 0, 0, True, auto=True, session=session)
        return self.get(user_id, language_id, session=session)

    @transactional
    def kinds(self, user_id: str, language_id: str, session: Optional[Session] = None) -> list[str]:
        """The goal types the course studies (its Element types setting): the card and the menu show only these."""
        wanted = resolve(user_id, language_id, "element_types", session=session)
        return [k for k in TYPES if k in wanted]

    def _hide_unstudied(self, goal: StudyGoal, user_id: str, session) -> None:
        """A type the course does not study has no quantity and no menu: its slots and picks go (also from the running menu)."""
        shown = self.kinds(user_id, goal.language_id, session=session)
        for kind, (_m, n_col, r_col) in TYPES.items():
            if kind in shown:
                continue
            setattr(goal, n_col, 0)
            setattr(goal, r_col, 0)
            if goal.locked:
                goal.locked = {**goal.locked, "n": {**goal.locked["n"], kind: 0}, "r": {**goal.locked["r"], kind: 0}}
            for item in session.query(StudyGoalItem).filter_by(goal_id=goal.id).all():
                if _type_of(item.element_id) == kind:
                    session.delete(item)
        session.flush()

    @transactional
    def targets(self, user_id: str, session: Optional[Session] = None) -> dict:
        """What a goal's quantities must add up to, per period: {period: {"n": total new, "r": total review}} from the pace numbers."""
        prefs = self._preferences(user_id, session)
        new, rev = (prefs.new_per_week, prefs.reviews_per_day) if prefs else (15, 40)
        return {k: {"n": round(new * d / 7), "r": round(rev * d / 7)} for k, d in PERIOD_DAYS.items()}

    @transactional
    def suggested(self, user_id: str, period: str = DEFAULT_GOAL_PERIOD, language_id: Optional[str] = None,
                  session: Optional[Session] = None) -> dict:
        """The suggested quantities for the user's new per week and reviews per day, split over the types the course studies:
        {"n": {type: n}, "r": {type: r}}."""
        return self._suggested(user_id, period, session, language_id)

    @transactional
    def ensure_cycle(self, user_id: str, language_id: str, today: Optional[date] = None,
                     session: Optional[Session] = None) -> list[StudyGoalItem]:
        """Make sure the running period has its menu, and return the open items of the menu.

        The menu is locked for the whole period: at its start the goal's quantities are frozen and, per type,
        N unstarted elements ("new", lesson order) and R already-seen ones ("review", highest review priority)
        are picked. Nothing is added, removed or resized until the period ends; only slots that could not be
        filled (not enough matching elements) are filled later, up to the frozen quantity.

        Open = a new element not yet mastered or a review element not yet reviewed since its period began;
        unfinished ones of earlier periods carry over."""
        today = today or self._today(user_id, session)
        goal = self._goal(user_id, language_id, session)
        if goal is not None:
            self._hide_unstudied(goal, user_id, session)
        if goal is None or not goal.active:
            return []
        self._drop_gone(goal, language_id, session)
        lock = self._lock(goal, today, session)
        start = lock["start"]
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        everything = {i.element_id for i in items}
        this_period = {i.element_id for i in items if i.cycle_start == start}
        done = self._done(items, user_id, session)
        carried_open = {i.element_id for i in items if i.cycle_start != start and i.id not in done}   # still on the list
        gated = GateService().gate_lesson(user_id, language_id, [m for m, _n, _r in TYPES.values()], session=session)   # soft gate (SG-6)
        for kind, (model, _n, _r) in TYPES.items():
            n_quota, r_quota = lock["n"][kind], lock["r"][kind]
            mine = [i for i in items if i.cycle_start == start and _type_of(i.element_id) == kind]
            for role, quota, pick in (("new", n_quota, self._new_elements), ("review", r_quota, self._review_elements)):
                missing = quota - sum(1 for i in mine if i.kind == role)
                if missing <= 0:
                    continue
                # new elements never repeat an earlier pick; a review element only has to be off this period's menu
                found = pick(model, language_id, user_id, everything if role == "new" else this_period | carried_open, missing, session,
                             only_lesson=gated if role == "new" else None)
                for element_id in found:
                    session.add(StudyGoalItem(id=db_manager.generate_new_id(StudyGoalItem, session=session), goal_id=goal.id,
                                              element_id=element_id, cycle_start=start, kind=role))
                    everything.add(element_id)
                    this_period.add(element_id)
        session.flush()
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        done = self._done(items, user_id, session)
        return [i for i in items if i.id not in done]

    @transactional
    def locked_kinds(self, user_id: str, language_id: str, today: Optional[date] = None,
                     session: Optional[Session] = None) -> set[str]:
        """The element types the running period's menu covers (an active goal with new or review slots for them)."""
        goal = self._goal(user_id, language_id, session)
        if goal is None or not goal.active:
            return set()
        lock = self._lock(goal, today or self._today(user_id, session), session)
        return {k for k in TYPES if lock["n"][k] + lock["r"][k] > 0}

    @transactional
    def progress(self, user_id: str, language_id: str, today: Optional[date] = None,
                 session: Optional[Session] = None) -> Optional[dict]:
        today = today or self._today(user_id, session)
        goal = self._goal(user_id, language_id, session)
        if goal is None:
            return None
        self.ensure_cycle(user_id, language_id, today=today, session=session)
        lock = self._lock(goal, today, session)
        start, end = lock["start"], lock["end"]
        items = session.query(StudyGoalItem).filter_by(goal_id=goal.id).all()
        done = self._done(items, user_id, session)
        types = {k: {"n": lock["n"][k], "picked": 0, "mastered": 0, "carried": 0,
                     "r": lock["r"][k], "review_picked": 0, "review_done": 0, "partial": 0.0, "review_partial": 0.0} for k in TYPES}
        part = self._partials(items, done, start, user_id, session)
        listed = []
        for i in items:
            kind = _type_of(i.element_id)
            row, finished = types[kind], i.id in done
            current = i.cycle_start == start
            if not current and finished:
                continue                                     # old periods only carry unfinished elements
            if current and i.id in part:
                row["partial" if i.kind == "new" else "review_partial"] += part[i.id]
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
                "rebuild": {"mastered": sum(1 for i in items if i.id in done and i.cycle_start == start),
                            "redraw": sum(1 for i in items if i.id not in done)},
                "next": {"start": end.isoformat(), "period": goal.period, "pending": pending,
                         "n": {k: getattr(goal, TYPES[k][1]) for k in TYPES}, "r": {k: getattr(goal, TYPES[k][2]) for k in TYPES}}}

    @transactional
    def mark_succeeded(self, user_id: str, element_id: str, now: Optional[datetime] = None, session: Optional[Session] = None) -> bool:
        """Called after an answer: if the element's effective score is now known, stamp its open goal items (once, never cleared)."""
        base = element_id.split("#")[0]
        open_items = (session.query(StudyGoalItem).join(StudyGoal, StudyGoal.id == StudyGoalItem.goal_id)
                      .filter(StudyGoal.user_id == user_id, StudyGoalItem.element_id == base, StudyGoalItem.kind == "new",
                              StudyGoalItem.succeeded_at.is_(None)).all())
        if not open_items or self._scores(user_id, [base], session).get(base, 0.0) < KNOWN_FROM:
            return False
        for i in open_items:
            i.succeeded_at = now or datetime.now()
        session.flush()
        return True

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

    def _suggested(self, user_id, period, session, language_id: Optional[str] = None) -> dict:
        prefs = self._preferences(user_id, session)
        shown = self.kinds(user_id, language_id, session=session) if language_id else list(TYPES)
        return default_goal_quantities(prefs.new_per_week if prefs else 15, prefs.reviews_per_day if prefs else 40,
                                       PERIOD_DAYS.get(period, 7), shown)

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
        # effective scores; a vocabulary is computed from its sides (no stored parent row)
        return {eid: r.score for eid, r in ScoreService().get_many(user_id, list(element_ids), session=session).items()}

    @staticmethod
    def _sides_seen(reviews, user_id, session):
        """({review item id: the cards to answer}, {card id: its latest answer}); a vocabulary is two cards (its sides)."""
        sides = {i.id: ([f"{i.element_id}#{s}" for s in SIDES] if _type_of(i.element_id) == "vocabulary" else [i.element_id]) for i in reviews}
        rows = session.query(Score.element_id, Score.last_seen_at).filter(
            Score.user_id == user_id, Score.element_id.in_([x for v in sides.values() for x in v])).all() if reviews else []
        seen: dict = {}
        for element_id, last in rows:       # a side has one row per skill: its latest answer counts
            if last and (seen.get(element_id) is None or last > seen[element_id]):
                seen[element_id] = last
        return sides, seen

    def _partials(self, items, done, start, user_id, session) -> dict[str, float]:
        """RC-27 / SG-13: how far each unmet item of the running period is (0..1): a new one by its score over the Known bar,
        a review one by the share of its sides answered since the period began. Uses no threshold but `KNOWN_FROM`."""
        open_items = [i for i in items if i.cycle_start == start and i.id not in done]
        news = [i for i in open_items if i.kind == "new"]
        scores = self._scores(user_id, [i.element_id for i in news], session)
        out = {i.id: min(scores.get(i.element_id, 0.0) / KNOWN_FROM, 1.0) for i in news}
        reviews = [i for i in open_items if i.kind == "review"]
        sides, seen = self._sides_seen(reviews, user_id, session)
        since = datetime.combine(start, time.min)
        for i in reviews:
            out[i.id] = sum(1 for x in sides[i.id] if (seen.get(x) or datetime.min) >= since) / len(sides[i.id])
        return out

    def _done(self, items, user_id, session) -> set[str]:
        """Ids of the finished items: a new one once it reached known at any moment (`succeeded_at`, permanent: decay never
        undoes it, DM-53), a review one once reviewed since its own period began (both sides for vocabulary)."""
        news = [i for i in items if i.kind == "new" and i.succeeded_at is None]
        if news:                                             # catch up scores that reached known outside `ScoreService.record`
            scores = self._scores(user_id, [i.element_id for i in news], session)
            for i in news:
                if scores.get(i.element_id, 0.0) >= KNOWN_FROM:
                    i.succeeded_at = datetime.now()
            session.flush()
        finished = {i.id for i in items if i.kind == "new" and i.succeeded_at is not None}
        reviews = [i for i in items if i.kind == "review"]
        sides, seen = self._sides_seen(reviews, user_id, session)
        for i in reviews:
            since = datetime.combine(i.cycle_start, time.min)
            if all((seen.get(x) or datetime.min) >= since for x in sides[i.id]):
                finished.add(i.id)
        return finished

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
    def _language_elements(model, language_id, session, only_lesson: Optional[str] = None) -> list[str]:
        q = session.query(model.id).join(Lesson, Lesson.id == model.lesson_id).filter(Lesson.language_id == language_id)
        if only_lesson:
            q = q.filter(model.lesson_id == only_lesson)
        return [r[0] for r in q.order_by(Lesson.position, Lesson.created_at, model.created_at, model.id).all()]

    @staticmethod
    def _new_elements(model, language_id, user_id, taken, n, session, only_lesson: Optional[str] = None) -> list[str]:
        """Up to n unseen element ids (SG-12: never answered, never scored) in lesson order, then creation order.
        `only_lesson`: the soft gate is closed, draw from that lesson only."""
        ids = [i for i in StudyGoalService._language_elements(model, language_id, session, only_lesson) if i not in taken]
        seen = StudyGoalService._seen(user_id, ids, session)
        return [i for i in ids if i not in seen][:n]

    @staticmethod
    def _seen(user_id, ids, session) -> dict:
        """Priority inputs of the elements the learner has met: a score above 0 or an answer ever given (a wrong first answer counts)."""
        now = datetime.now()
        rows = ScoreService().priority_inputs(user_id, ids, now, learner_today(None, now), session=session) if ids else {}
        return {i: r for i, r in rows.items() if r.score > 0 or r.last_seen_at is not None}

    @staticmethod
    def _review_elements(model, language_id, user_id, taken, n, session, only_lesson: Optional[str] = None) -> list[str]:
        """Up to n already-seen element ids (they have a Score row), the ones most due first (`review_priority`)."""
        ids = [i for i in StudyGoalService._language_elements(model, language_id, session) if i not in taken]
        if not ids:
            return []
        now = datetime.now()
        seen = StudyGoalService._seen(user_id, ids, session)   # ponytail: server zone until the learner's zone is passed in (Task 5)
        ranked = sorted(seen, key=lambda i: review_priority(seen[i].score, seen[i].stability, seen[i].last_seen_at, seen[i].lapses, now), reverse=True)
        return ranked[:n]
