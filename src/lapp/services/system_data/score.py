from dataclasses import dataclass, field
from datetime import date, datetime, tzinfo
from statistics import mean
from typing import Optional

from sqlalchemy import String, any_, literal, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import Score
from ...utils.element_kinds import kind_of
from ...utils.scoring import (
    DAY_GAIN_CAP, EVIDENCE_WEIGHTS, STABILITY_CAP_DAYS, ScoreState, apply_answer, effective_score, grammar_blend, grammar_weight, is_weak, level_for,
)

SIDES = ("front", "back")
DEFAULT_SKILL = "recall"        # aggregate rows (lesson, language, word, passage, exercise) keep this single skill


def side_id(voc_id: str, side: str) -> str:
    return f"{voc_id}#{side}"


def _is_voc_parent(element_id: str) -> bool:
    return element_id.startswith("voc_") and "#" not in element_id


def _decays(element_id: str) -> bool:
    """Rows of kinds with skills decay on read; aggregates are derived values refreshed by their children."""
    kind = kind_of(element_id)
    return bool(kind and kind.skills)


def _rows_by_element(session: Session, user_id: str, wanted: set) -> dict:
    """The user's Score rows for these element ids, grouped by element. The ids travel as ONE array parameter
    (`= ANY(...)`), not one bind parameter each, and come back as plain rows (no ORM entities): a language's worth of
    ids per call made query parsing and hydration the cost of the review queue and the home stats."""
    by_el: dict = {}
    if not wanted:
        return by_el
    ids = literal(sorted(wanted), ARRAY(String))
    for r in session.execute(select(Score.__table__).where(Score.user_id == user_id, Score.element_id == any_(ids))):
        by_el.setdefault(r.element_id, []).append(r)
    return by_el


def _effective(row: Score, now: datetime) -> float:
    return effective_score(row.score, row.stability, row.last_seen_at, now) if _decays(row.element_id) else row.score


def _row_view(row: Score, now: datetime) -> dict:
    return {"score": _effective(row, now), "level": level_for(_effective(row, now)), "is_leech": bool(row.is_leech),
            "last_seen_at": row.last_seen_at, "difficulty": row.difficulty, "stability": row.stability}


@dataclass
class _Summary:
    """What a read sees for one element: the mean over its skills, plus the per-skill breakdown."""
    score: float
    difficulty: float
    created_at: Optional[datetime]
    last_seen_at: Optional[datetime]
    note: Optional[str]
    current_lesson_id: Optional[str]
    skills: dict = field(default_factory=dict)
    sides: dict = field(default_factory=dict)       # vocabulary only: {"front": {score, difficulty}, ...}
    weight: float = 1.0                             # grammar only: weight of the reading card in `score` (SC-30)
    flat: Optional[float] = None                    # grammar only: the blend, what an aggregate averages (one entry, not two rows)

    @property
    def is_leech(self) -> bool:
        return any(s["is_leech"] for s in self.skills.values())


def _leaf(rows: list, now: datetime) -> _Summary:
    skills = {r.skill: _row_view(r, now) for r in rows}
    seen = [r.last_seen_at for r in rows if r.last_seen_at]
    return _Summary(
        score=round(mean(v["score"] for v in skills.values()), 4),
        difficulty=round(mean(r.difficulty for r in rows), 4),
        created_at=min(r.created_at for r in rows), last_seen_at=max(seen) if seen else None,
        note=next((r.note for r in rows if r.note), None),
        current_lesson_id=next((r.current_lesson_id for r in rows if r.current_lesson_id), None),
        skills=skills)


PRACTICE = "practice"      # a grammar's exercise-credit skill; the reading card keeps "recognition" (SC-30)


def _grammar_parts(rows: list, now: datetime) -> tuple[float, float]:
    """(blended score, reading weight) of a grammar from its reading and exercise rows. Only exercises answered: their score alone."""
    reading = [_effective(r, now) for r in rows if r.skill != PRACTICE]
    practice = next((r for r in rows if r.skill == PRACTICE), None)
    if not reading:
        return (_effective(practice, now) if practice else 0.0), 1.0
    p_score = _effective(practice, now) if practice else None
    n = len(practice.recent or "") if practice else 0
    return grammar_blend(mean(reading), p_score, n), grammar_weight(p_score, n)


def _grammar(rows: list, now: datetime) -> _Summary:
    summary = _leaf(rows, now)
    summary.score, summary.weight = _grammar_parts(rows, now)
    summary.score = round(summary.score, 4)
    summary.flat = summary.score
    return summary


def _vocabulary(parent_rows: list, side_rows: dict, now: datetime) -> Optional[_Summary]:
    """Parent per skill = mean of the sides. A side never answered counts 0; a side that was answered but does
    not carry the skill is skipped for it (a face tests one skill: front recognition, back recall)."""
    if not any(side_rows.values()):
        return _leaf(parent_rows, now) if parent_rows else None
    skill_names = sorted({r.skill for rs in side_rows.values() for r in rs})
    skills = {}
    for sk in skill_names:
        vals, leech, seen, stab = [], False, [], []
        for rs in side_rows.values():
            if not rs:
                vals.append(0.0)
                continue
            r = next((r for r in rs if r.skill == sk), None)
            if r is not None:
                vals.append(_effective(r, now))
                leech |= bool(r.is_leech)
                stab.append(r.stability)
                if r.last_seen_at:
                    seen.append(r.last_seen_at)
        score = mean(vals)
        skills[sk] = {"score": score, "level": level_for(score), "is_leech": leech,
                      "last_seen_at": max(seen) if seen else None, "stability": min(stab) if stab else None}
    sides = {sd: _leaf(rs, now) for sd, rs in side_rows.items() if rs}
    every = [r for rs in side_rows.values() for r in rs] + parent_rows
    seen = [r.last_seen_at for r in every if r.last_seen_at]
    return _Summary(
        score=round(mean(v["score"] for v in skills.values()), 4),
        difficulty=round(mean(sides[sd].difficulty if sd in sides else 0.5 for sd in SIDES), 4),
        created_at=min(r.created_at for r in every), last_seen_at=max(seen) if seen else None,
        note=next((r.note for r in every if r.note), None),
        current_lesson_id=next((r.current_lesson_id for r in every if r.current_lesson_id), None),
        skills=skills, sides={sd: {"score": s.score, "difficulty": s.difficulty} for sd, s in sides.items()})


@dataclass
class PriorityInput:
    """What `review_priority` needs for one element (decay applied), plus whether today's gain cap is reached."""
    score: float
    stability: float
    last_seen_at: Optional[datetime]
    lapses: int             # wrong answers among the last 8 (the engine's `recent`)
    weight: float = 1.0     # grammar only: reading-card weight (SC-30); the queue scales the priority by it
    capped: bool = False    # every skill already gained DAY_GAIN_CAP today: more answers earn nothing (spec G3)


class ScoreService:
    @transactional
    def record(self, user_id: str, element_id: str, skill: str, quality: float, evidence_type: str,
               tz: Optional[tzinfo] = None, session: Optional[Session] = None) -> Score:
        """Create/update a user's score row for (element, skill) through the engine (single write path)."""
        if evidence_type not in EVIDENCE_WEIGHTS:
            raise ValueError(f"evidence_type must be one of {sorted(EVIDENCE_WEIGHTS)}, got {evidence_type!r}")
        now = datetime.now()
        row = session.query(Score).filter(
            Score.user_id == user_id, Score.element_id == element_id, Score.skill == skill).first()
        if row is None:
            row = Score(id=db_manager.generate_new_id(Score, session=session), user_id=user_id,
                        element_id=element_id, skill=skill, score=0.0, difficulty=0.5,
                        created_at=now)             # first engagement, set once
            session.add(row)
            session.flush()
        new = apply_answer(
            ScoreState(row.score, row.stability, row.last_seen_at, row.recent, row.is_leech, row.day_date, row.day_gain),
            quality, EVIDENCE_WEIGHTS[evidence_type], now, tz)
        row.score, row.stability, row.last_seen_at = round(new.score, 4), new.stability, new.last_seen_at
        row.recent, row.is_leech, row.day_date, row.day_gain = new.recent, new.is_leech, new.day_date, new.day_gain
        # difficulty follows stability (1 = about to be forgotten) so readers that still use it keep working until Task 8
        row.difficulty = round(1 - min(new.stability, STABILITY_CAP_DAYS) / STABILITY_CAP_DAYS, 4)
        session.flush()
        from ..features.study_goal import StudyGoalService      # lazy: features import this module
        StudyGoalService().mark_succeeded(user_id, element_id, now, session=session)    # reached known once = succeeded for good (DM-53)
        return row

    @transactional
    def record_side(self, user_id: str, voc_id: str, side: str, skill: str, quality: float, evidence_type: str,
                    tz: Optional[tzinfo] = None, session: Optional[Session] = None) -> Score:
        """Grade one side of a vocabulary for a skill. Returns the parent as seen after the answer."""
        if side not in SIDES:
            raise ValueError(f"side must be one of {SIDES}, got {side!r}")
        self.record(user_id, side_id(voc_id, side), skill, quality, evidence_type, tz=tz, session=session)
        return self.get(user_id, voc_id, session=session)

    def _collect(self, session: Session, user_id: str, element_ids: list, now: datetime) -> dict:
        ids = set(element_ids)
        wanted = ids | {side_id(i, s) for i in ids if _is_voc_parent(i) for s in SIDES}
        by_el = _rows_by_element(session, user_id, wanted)
        out = {}
        for eid in ids:
            if _is_voc_parent(eid):
                summary = _vocabulary(by_el.get(eid, []), {s: by_el.get(side_id(eid, s), []) for s in SIDES}, now)
            elif eid.startswith("gram_") and by_el.get(eid):
                summary = _grammar(by_el[eid], now)
            else:
                summary = _leaf(by_el[eid], now) if by_el.get(eid) else None
            if summary is not None:
                out[eid] = summary
        return out

    @staticmethod
    def _view(user_id: str, element_id: str, s: _Summary) -> Score:
        """A transient (never added to a session) Score carrying the effective values, for readers that want one row."""
        return Score(id=f"view:{element_id}", user_id=user_id, element_id=element_id, score=s.score,
                     difficulty=s.difficulty, created_at=s.created_at, last_seen_at=s.last_seen_at, note=s.note,
                     current_lesson_id=s.current_lesson_id, skill=DEFAULT_SKILL)

    @transactional
    def get_sides(self, user_id: str, voc_id: str,
                  session: Optional[Session] = None) -> dict[str, Optional[Score]]:
        rows = self.get_many(user_id, [side_id(voc_id, s) for s in SIDES], session=session)
        return {s: rows.get(side_id(voc_id, s)) for s in SIDES}

    @transactional
    def get(self, user_id: str, element_id: str, skill: Optional[str] = None,
            session: Optional[Session] = None) -> Optional[Score]:
        """With a skill: that stored row. Without: the element as one effective row (mean of its skills)."""
        if skill is not None:
            return session.query(Score).filter(Score.user_id == user_id, Score.element_id == element_id,
                                               Score.skill == skill).first()
        return self.get_many(user_id, [element_id], session=session).get(element_id)

    @transactional
    def skill_scores(self, user_id: str, element_ids: list[str], now: Optional[datetime] = None,
                     session: Optional[Session] = None) -> dict[str, dict[str, float]]:
        """Effective score per answered skill, per element (decay applied, nothing written)."""
        if not element_ids:
            return {}
        found = self._collect(session, user_id, list(element_ids), now or datetime.now())
        return {eid: ({"recognition": s.flat} if s.flat is not None else {k: v["score"] for k, v in s.skills.items()})
                for eid, s in found.items()}

    @transactional
    def get_many(self, user_id: str, element_ids: list[str], now: Optional[datetime] = None,
                 session: Optional[Session] = None) -> dict[str, Score]:
        """One effective row per element that has a score (decay applied on read, nothing written)."""
        if not element_ids:
            return {}
        found = self._collect(session, user_id, list(element_ids), now or datetime.now())
        return {eid: self._view(user_id, eid, s) for eid, s in found.items()}

    @transactional
    def priority_inputs(self, user_id: str, element_ids: list[str], now: datetime, today: date,
                        session: Optional[Session] = None) -> dict[str, PriorityInput]:
        """Review-priority inputs per element that has a score row. A vocabulary id combines its sides (mean score,
        least stable, most recent, most lapses); `today` is the learner's day for the gain cap."""
        ids = set(element_ids)
        wanted = ids | {side_id(i, s) for i in ids if _is_voc_parent(i) for s in SIDES}
        by_el = _rows_by_element(session, user_id, wanted)
        out = {}
        for eid in ids:
            rows = by_el.get(eid, [])
            if _is_voc_parent(eid):
                rows = rows + [r for s in SIDES for r in by_el.get(side_id(eid, s), [])]
            if not rows:
                continue
            seen = [r.last_seen_at for r in rows if r.last_seen_at]
            blended, weight = _grammar_parts(rows, now) if eid.startswith("gram_") else (None, 1.0)
            out[eid] = PriorityInput(
                score=mean(_effective(r, now) for r in rows) if blended is None else blended, weight=weight, stability=min(r.stability for r in rows),
                last_seen_at=max(seen) if seen else None, lapses=max(r.recent.count("0") for r in rows),
                capped=all(r.day_date == today and r.day_gain >= DAY_GAIN_CAP for r in rows))
        return out

    @transactional
    def set(self, user_id: str, element_id: str, score: float, difficulty: float,
            current_lesson_id: Optional[str] = None, touch: bool = True,
            session: Optional[Session] = None) -> Score:
        """Upsert an aggregate row (container/component) with explicit values: one `recall` row, no decay of its own.
        `touch=False` leaves `last_seen_at` alone (None on a new row): a recompute that is not a review, e.g. a lesson merge."""
        now = datetime.now()
        row = session.query(Score).filter(
            Score.user_id == user_id, Score.element_id == element_id, Score.skill == DEFAULT_SKILL).first()
        if row is None:
            row = Score(
                id=db_manager.generate_new_id(Score, session=session),
                user_id=user_id,
                element_id=element_id,
                skill=DEFAULT_SKILL,
                score=score,
                difficulty=difficulty,
                created_at=now,
                last_seen_at=now if touch else None,
                current_lesson_id=current_lesson_id,
            )
            session.add(row)
        else:
            row.score = score
            row.difficulty = difficulty
            if touch:
                row.last_seen_at = now
            if current_lesson_id is not None:
                row.current_lesson_id = current_lesson_id
        session.flush()
        return row

    @transactional
    def delete_for(self, element_ids: list[str], session: Optional[Session] = None) -> None:
        """Drop every user's Score rows for these elements (vocabulary: also the #front/#back rows)."""
        ids = [*element_ids, *(side_id(i, s) for i in element_ids if i.startswith("voc_") for s in SIDES)]
        session.query(Score).filter(Score.element_id.in_(ids)).delete(synchronize_session=False)

    @transactional
    def merge(self, user_id: str, elements: list[dict],
              session: Optional[Session] = None) -> list[dict]:
        """Inject score/difficulty/score_level/weak/skills/last_seen_at into serialized element dicts."""
        found = self._collect(session, user_id, [e["id"] for e in elements if e.get("id")], datetime.now())
        for e in elements:
            eid = e.get("id")
            s = found.get(eid)
            if eid and eid.startswith("voc_"):
                for sd in SIDES:
                    side = (s.sides.get(sd) if s else None) or {}
                    e[f"{sd}_score"] = side.get("score", 0.0)
                    e[f"{sd}_difficulty"] = side.get("difficulty", 0.5)
            e["score"] = s.score if s else 0.0
            e["difficulty"] = s.difficulty if s else 0.5
            e["score_level"] = level_for(e["score"])     # not `level`: containers keep their CEFR index there
            e["weak"] = is_weak(e["score"])
            e["skills"] = s.skills if s else {}
            stab = [v["stability"] for v in e["skills"].values() if v.get("stability")] if eid and eid.startswith(("voc_", "gram_", "call_")) else []
            e["stability"] = min(stab) if stab else None      # the first skill to fade sets the estimate; aggregates have none
            e["is_leech"] = s.is_leech if s else False
            e["last_seen_at"] = s.last_seen_at if s else None
            e["current_lesson_id"] = s.current_lesson_id if s else None
            e["note"] = s.note if s else None
        return elements

    @transactional
    def set_note(self, user_id: str, element_id: str, note: str, session: Optional[Session] = None) -> None:
        """Save the user's own note on an element (empty clears it); the note sits on every skill row of the element,
        and a zero `recall` row is created when the element was never reviewed."""
        rows = session.query(Score).filter(Score.user_id == user_id, Score.element_id == element_id).all()
        if not rows:
            rows = [Score(id=db_manager.generate_new_id(Score, session=session), user_id=user_id, element_id=element_id,
                          skill=DEFAULT_SKILL, score=0.0, difficulty=0.5, created_at=datetime.now())]
            session.add(rows[0])
        for r in rows:
            r.note = note or None
        session.flush()
