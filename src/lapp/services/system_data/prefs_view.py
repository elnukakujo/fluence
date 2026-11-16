"""One read of the preferences the study engine needs, with defaults when the learner has no row.

Spec 4 adds the screens and the per-skill switches; until then `enabled_skills` is empty (= every skill on).
"""
from dataclasses import dataclass, field

from ...core.database import db_manager
from ...models.system_data import UserPreferences

STREAK_MIN_ANSWERS_DEFAULT = 20
DAILY_MINUTES_DEFAULT = 20


@dataclass
class PrefsView:
    timezone: str | None = None
    streak_min_answers: int = STREAK_MIN_ANSWERS_DEFAULT
    enabled_skills: dict[str, set[str]] = field(default_factory=dict)
    daily_minutes: int = DAILY_MINUTES_DEFAULT


def prefs_for(user_id: str, language_id: str | None = None, session=None) -> PrefsView:
    row = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
    if row is None:
        return PrefsView()
    return PrefsView(timezone=row.timezone,
                     streak_min_answers=row.streak_min_answers or STREAK_MIN_ANSWERS_DEFAULT,
                     daily_minutes=row.daily_goal_minutes or DAILY_MINUTES_DEFAULT)
