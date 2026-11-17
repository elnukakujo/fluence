"""Settings groups 1-4 and the skills selection (spec 4, Task 5; catalogue in docs/domain/platform/user-settings.md).

Each key has a scope (account column, or course override in `course_setting`), a default and a validator.
`resolve` = course value, else account value, else the documented default (US-R1/R2). A group is updated on its own (US-R3).
"""
from dataclasses import dataclass
from typing import Any, Callable, Optional

from ...core.database import db_manager, transactional
from ...models.system_data import CourseSetting, UserPreferences
from ...utils.element_kinds import _KINDS
from .presets import PRESETS

ELEMENT_TYPES = ("vocabulary", "grammar", "characters", "calligraphy", "exercises", "passages")
LOCALES = ("en", "fr", "zh")


def _bool(v):
    if not isinstance(v, bool):
        raise ValueError("must be true or false")
    return v


def _int_between(lo, hi, step=1):
    def check(v):
        if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi or (v - lo) % step:
            raise ValueError(f"must be a whole number from {lo} to {hi}" + (f" in steps of {step}" if step > 1 else ""))
        return v
    return check


def _choice(*options, nullable=False):
    def check(v):
        if v is None and nullable:
            return None
        if v not in options:
            raise ValueError(f"must be one of {', '.join(options)}")
        return v
    return check


def _element_types(v):
    if not isinstance(v, list) or not v or any(x not in ELEMENT_TYPES for x in v):
        raise ValueError(f"must be a non-empty list of {', '.join(ELEMENT_TYPES)}")
    return sorted(set(v), key=ELEMENT_TYPES.index)


def _via_schema(key):
    """Keys that already have a validator on the preferences schema (layout, side mix, exercise boost/ban, languages)."""
    def check(v):
        from ...schemas.system_data import UserPreferencesDict
        return getattr(UserPreferencesDict(**{key: v}), key)
    return check


def _skills(v):
    if not isinstance(v, dict):
        raise ValueError("must map element kinds to skill lists")
    by_name = {k.name: k for k in _KINDS.values() if k.skills}
    out = {}
    for kind, skills in v.items():
        if kind not in by_name:
            raise ValueError(f"{kind} has no skills to choose from")
        if not isinstance(skills, list) or not skills or any(s not in by_name[kind].skills for s in skills):
            raise ValueError(f"{kind}: pick at least one of {', '.join(by_name[kind].skills)}")
        out[kind] = [s for s in by_name[kind].skills if s in skills]
    return out


@dataclass(frozen=True)
class Setting:
    group: str
    scope: str          # "account" | "course"
    default: Any
    check: Callable[[Any], Any]
    nullable: bool = False


SETTINGS: dict[str, Setting] = {
    # 1 Learning pace
    "daily_goal_minutes": Setting("pace", "account", 20, _int_between(5, 60, 5)),
    "streak_min_answers": Setting("pace", "account", 20, _int_between(1, 1000)),
    "new_per_week": Setting("pace", "account", 15, _int_between(0, 1000)),
    "reviews_per_day": Setting("pace", "account", 40, _int_between(0, 1000)),
    "weekly_goals_on": Setting("pace", "course", True, _bool),
    "soft_gate": Setting("pace", "course", True, _bool),
    # 2 What I review
    "review_layout": Setting("review", "account", None, _via_schema("review_layout"), True),
    "exercise_type_prefs": Setting("review", "account", {}, _via_schema("exercise_type_prefs")),
    "voc_side_pattern": Setting("review", "account", None, _via_schema("voc_side_pattern"), True),
    "element_types": Setting("review", "course", list(ELEMENT_TYPES), _element_types),
    "include_shared": Setting("review", "course", True, _bool),
    # 3 How I answer
    "hints_enabled": Setting("answer", "account", True, _bool),
    "retry_wrong": Setting("answer", "account", True, _bool),
    "calligraphy_draw_first": Setting("answer", "account", True, _bool),
    "calligraphy_stroke_guide": Setting("answer", "account", True, _bool),
    "audio_autoplay": Setting("answer", "account", False, _bool),
    "typing_strictness": Setting("answer", "course", "forgiving", _choice("forgiving", "exact")),
    # 4 What I see
    "show_scores": Setting("see", "account", False, _bool),
    "interface_language": Setting("see", "account", None, _choice(*LOCALES, nullable=True), True),
    "theme": Setting("see", "account", "system", _choice("system", "light", "dark")),
    "native_language_iso639_2": Setting("see", "account", ["eng"], _via_schema("native_language_iso639_2")),
    "show_phonetics": Setting("see", "course", "after_reveal", _choice("always", "after_reveal", "never")),
    # Skills per element kind (DM-43)
    "enabled_skills": Setting("skills", "account", {}, _skills),
}
GROUPS = ("pace", "review", "answer", "see", "skills")


class SettingsError(ValueError):
    """A value the group refuses; the message names the key."""


def _row(user_id: str, session) -> Optional[UserPreferences]:
    return db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)


def _account_value(row: Optional[UserPreferences], key: str):
    value = getattr(row, key, None) if row is not None else None
    return SETTINGS[key].default if value is None else value


def _course_overrides(user_id: str, language_id: Optional[str], session) -> dict:
    if not language_id:
        return {}
    rows = session.query(CourseSetting).filter(CourseSetting.user_id == user_id, CourseSetting.language_id == language_id).all()
    return {r.key: r.value for r in rows}


@transactional
def resolve(user_id: str, language_id: Optional[str], key: str, session=None):
    """Course value, else account value, else the documented default."""
    st = SETTINGS[key]
    if st.scope == "course":
        overrides = _course_overrides(user_id, language_id, session)
        if key in overrides:
            return overrides[key]
        return st.default
    return _account_value(_row(user_id, session), key)


@transactional
def read_group(user_id: str, group: str, language_id: Optional[str] = None, session=None) -> dict:
    """{"values": {key: resolved value}, "scopes": {key: "account" | "course"}, "overridden": [course keys with a value]}."""
    row = _row(user_id, session)
    overrides = _course_overrides(user_id, language_id, session)
    values, scopes = {}, {}
    for key, st in SETTINGS.items():
        if st.group != group:
            continue
        scopes[key] = st.scope
        values[key] = overrides.get(key, st.default) if st.scope == "course" else _account_value(row, key)
    return {"values": values, "scopes": scopes, "overridden": [k for k in overrides if k in values]}


@transactional
def update_group(user_id: str, group: str, values: dict, language_id: Optional[str] = None, session=None) -> dict:
    """Update only the keys given, all of them in `group` (a bad key or value changes nothing). A course key with
    `None` removes the override (inherits). Course keys need `language_id`."""
    if group not in GROUPS:
        raise SettingsError(f"unknown group: {group}")
    clean: dict[str, Any] = {}
    for key, value in values.items():
        st = SETTINGS.get(key)
        if st is None or st.group != group:
            raise SettingsError(f"{key} is not a {group} setting")
        if st.scope == "course" and not language_id:
            raise SettingsError(f"{key} is set per course: language_id is required")
        if value is None and st.scope == "course":
            clean[key] = None
            continue
        try:
            clean[key] = st.check(value)
        except ValueError as e:
            raise SettingsError(f"{key}: {e}") from None
    row = _row(user_id, session)
    if row is None:
        raise SettingsError("no preferences for this user")
    for key, value in clean.items():
        st = SETTINGS[key]
        if st.scope == "account":
            setattr(row, key, value)
            continue
        existing = session.query(CourseSetting).filter_by(user_id=user_id, language_id=language_id, key=key).first()
        if value is None:
            if existing:
                session.delete(existing)
        elif existing:
            existing.value = value
        else:
            session.add(CourseSetting(id=db_manager.generate_new_id(model_class=CourseSetting, session=session),
                                      user_id=user_id, language_id=language_id, key=key, value=value))
    session.flush()
    return read_group(user_id, group, language_id, session=session)


@transactional
def apply_preset(user_id: str, name: str, session=None) -> dict:
    """Pace only: sets new/week, reviews/day and the streak minimum; skills and everything else stay."""
    if name not in PRESETS:
        raise SettingsError(f"unknown preset: {name}")
    return update_group(user_id, "pace", dict(PRESETS[name]), session=session)
