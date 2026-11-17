"""The learner's own clock: every 'today' and 'week' in the study code goes through here (never date.today()).

A day is the calendar day in the learner's IANA time zone; a week runs Monday..Sunday and closes Sunday 23:59:59
local time (DM-37). An empty or unknown zone falls back to the server's local zone.
"""
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def zone(tz_name: str | None) -> tzinfo:
    try:
        if tz_name:
            return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        pass
    return datetime.now().astimezone().tzinfo


def learner_today(tz_name: str | None, now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(zone(tz_name)).date()


def week_bounds(tz_name: str | None, d: date) -> tuple[date, date]:
    """Monday..Sunday containing d. Pure calendar arithmetic: a DST change never shifts it (tz kept for symmetry)."""
    start = d - timedelta(days=d.weekday())
    return start, start + timedelta(days=6)


def week_closed_at(tz_name: str | None, week_start: date) -> datetime:
    """Sunday 23:59:59 of the week starting on week_start, as an aware datetime in the learner's zone."""
    return datetime.combine(week_start + timedelta(days=6), time(23, 59, 59), tzinfo=zone(tz_name))
