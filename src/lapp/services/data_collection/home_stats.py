"""Headline numbers for the home page and per-language trends (LS-5, LS-19, LS-24, DM-7, DM-47)."""
from datetime import date, datetime, timedelta
from statistics import median
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import transactional
from ...models.containers import Language
from ...models.data_collection import DailyStats, LearnerDay, WeeklySnapshot
from ...models.features import Calligraphy, Exercise, Grammar, Vocabulary
from ...models.containers import Lesson
from ..system_data import ScoreService
from ...models.system_data import StudyGoal, StudyGoalItem
from ...utils.scoring import KNOWN_FROM
from ...utils.learner_clock import learner_today, week_bounds
from ..features.review_queue import Scope, build_queue, card_seconds, collect_candidates, plan_budgets
from ..system_data.prefs_view import prefs_for
from .study_activity import status_for
from .weekly_snapshot import level_counts

HEATMAP_WEEKS = 12
# Decided by the owner (2026-11-17, RD-87): band edges are multiples of the learner's own median busy day.
BAND_FACTORS = (0.5, 1.0, 1.5)


def heatmap_bands(days: list[int]) -> list[int]:
    """Upper edges of bands 1..3 (band 4 is everything above): multiples of the median of the days with any answer."""
    busy = [d for d in days if d > 0]
    m = median(busy) if busy else 1
    return [max(1, round(m * f)) for f in BAND_FACTORS]


@transactional
def home(user_id: str, tz: Optional[str] = None, session: Optional[Session] = None) -> dict:
    now = datetime.now()
    today = learner_today(tz)
    status = status_for(user_id, today, session)
    prefs = prefs_for(user_id, None, session)
    since = week_bounds(tz, today)[0] - timedelta(weeks=HEATMAP_WEEKS - 1)
    per_day = {d.day: d.answers for d in session.query(LearnerDay).filter(LearnerDay.user_id == user_id, LearnerDay.day >= since)}
    weeks = []
    for i in range(HEATMAP_WEEKS):
        start = since + timedelta(weeks=i)
        weeks.append({"week_start": start.isoformat(), "answers": sum(per_day.get(start + timedelta(days=k), 0) for k in range(7))})
    languages = [language_summary(user_id, lang_id, today, session=session) for (lang_id,) in
                 session.query(Language.id).filter(Language.user_id == user_id).order_by(Language.created_at)]
    return {"streak": status.streak, "today": {"answers": status.answers, "min": prefs.streak_min_answers, "validated": status.validated},
            "languages": languages, "weeks": weeks, "heatmap_bands": heatmap_bands(list(per_day.values())),
            "week_delta": weeks[-1]["answers"] - weeks[-2]["answers"] if len(weeks) > 1 else 0}


@transactional
def language_summary(user_id: str, language_id: str, today: date, session: Optional[Session] = None) -> Optional[dict]:
    """One language's entry of `home()["languages"]`; None when it does not exist or is not `user_id`'s."""
    language = session.query(Language).filter(Language.id == language_id, Language.user_id == user_id).first()
    if language is None:
        return None
    c = level_counts(user_id, language.id, datetime.now(), session=session)
    stats = session.query(DailyStats).filter(DailyStats.user_id == user_id, DailyStats.language_id == language.id,
                                             DailyStats.created_at >= datetime.combine(today, datetime.min.time())).first()
    due, seconds = _due(user_id, language.id, session)
    return {
        "id": language.id, "name": language.name,
        "levels": {"learning": c["learning"], "known": c["known"], "mastered": c["mastered"]},
        "fading": c["fading"], "coverage": c["seen"] / c["total"] if c["total"] else 0.0, "mean_seen": c["mean_seen"],
        "due": due, "due_minutes": round(seconds / 60), "minutes_today": round((stats.time_studied_ms if stats else 0) / 60000)}


def _due(user_id: str, language_id: str, session: Session) -> tuple[int, float]:
    """What the daily review would serve now: card count and estimated seconds (LS-24)."""
    cands = collect_candidates(user_id, language_id, Scope(), session)
    if cands is None:
        return 0, 0.0
    budgets = plan_budgets(cands, prefs_for(user_id, language_id, session), None, None)
    queue, _sections, _spares = build_queue(cands, budgets)
    return len(queue), sum(card_seconds(c, budgets.paces) for c in queue)


@transactional
def snapshots(user_id: str, language_id: str, weeks: int = 12, session: Optional[Session] = None) -> list[dict]:
    rows = session.query(WeeklySnapshot).filter_by(user_id=user_id, language_id=language_id) \
        .order_by(WeeklySnapshot.week_start.desc()).limit(max(1, min(weeks, 104))).all()
    return [{**r.to_dict(), "coverage": r.n_seen / r.n_total if r.n_total else 0.0} for r in reversed(rows)]


_MODELS = {"vocabulary": Vocabulary, "grammar": Grammar, "calligraphy": Calligraphy}


@transactional
def type_stats(user_id: str, language_id: str, session: Optional[Session] = None) -> Optional[dict]:
    """Per studied type, for the custom review's Type tab (RE-15): {total, seen, mean_seen, fading, due}. `due` is how many cards of that type
    the daily review would serve now; `fading` the ones that reached Known once and are below it now; exercises only have total and due."""
    if session.query(Language.id).filter(Language.id == language_id, Language.user_id == user_id).first() is None:
        return None
    now = datetime.now()
    succeeded = {i for (i,) in session.query(StudyGoalItem.element_id).join(StudyGoal, StudyGoal.id == StudyGoalItem.goal_id).filter(
        StudyGoal.user_id == user_id, StudyGoal.language_id == language_id, StudyGoalItem.succeeded_at.isnot(None))}
    out = {}
    for name, model in _MODELS.items():
        ids = [i for (i,) in session.query(model.id).join(Lesson, Lesson.id == model.lesson_id).filter(Lesson.language_id == language_id)]
        scores = ScoreService().get_many(user_id, ids, now=now, session=session)
        by = [r.score or 0.0 for r in scores.values()]
        out[name] = {"total": len(ids), "seen": len(by), "mean_seen": round(sum(by) / len(by), 1) if by else None, "due": 0,
                     "fading": sum(1 for i in succeeded if i in scores and (scores[i].score or 0.0) < KNOWN_FROM)}
    out["exercise"] = {"total": session.query(Exercise.id).join(Lesson, Lesson.id == Exercise.lesson_id).filter(
        Lesson.language_id == language_id, Exercise.review_reason.is_(None)).count(), "seen": None, "mean_seen": None, "fading": None, "due": 0}
    cands = collect_candidates(user_id, language_id, Scope(), session)
    if cands is not None:
        queue, _sections, _spares = build_queue(cands, plan_budgets(cands, prefs_for(user_id, language_id, session), None, None))
        due: dict[str, set] = {name: set() for name in out}       # a vocabulary is two cards (its sides) but one thing to know: count it once
        for card in queue:
            kind = (card[0] if isinstance(card, tuple) else card)
            name = "exercise" if isinstance(kind, Exercise) else next((n for n, m in _MODELS.items() if isinstance(kind, m)), None)
            if name:
                due[name].add(kind.id)
        for name, ids in due.items():
            out[name]["due"] = len(ids)
    return out
