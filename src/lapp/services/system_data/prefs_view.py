"""One read of the preferences the study engine needs, with defaults when the learner has no row.

`enabled_skills` ({kind name: skills}, from the Skills settings) is empty = every skill on. TODO(owner): scoring does not read it yet (`score_cascade.aggregate` still gets all skills).
"""
from dataclasses import dataclass, field

from zoneinfo import available_timezones

from ...core.database import db_manager, transactional
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
                     enabled_skills={k: set(v) for k, v in (row.enabled_skills or {}).items()},
                     streak_min_answers=row.streak_min_answers or STREAK_MIN_ANSWERS_DEFAULT,
                     daily_minutes=row.daily_goal_minutes or DAILY_MINUTES_DEFAULT)


@transactional
def remember_timezone(user_id: str, tz_name: str | None, session=None) -> bool:
    """Store the browser's zone as the learner's (it follows them when they travel). Ignores an unknown name and a learner without preferences."""
    if not tz_name or tz_name not in available_timezones():
        return False
    row = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
    if row is None or row.timezone == tz_name:
        return False
    row.timezone = tz_name
    session.flush()
    return True
