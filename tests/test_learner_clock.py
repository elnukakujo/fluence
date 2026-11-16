"""Learner-clock helpers: every 'today'/'week' is computed on the learner's own time zone."""
from datetime import date, datetime, timezone

from lapp.utils.learner_clock import learner_today, week_bounds, week_closed_at


def utc(*a):
    return datetime(*a, tzinfo=timezone.utc)


def test_today_follows_the_learner_zone():
    assert learner_today("Pacific/Auckland", utc(2026, 11, 14, 23, 30)) == date(2026, 11, 15)   # UTC+13
    assert learner_today("Pacific/Honolulu", utc(2026, 11, 15, 2, 0)) == date(2026, 11, 14)     # UTC-10
    assert learner_today("UTC", utc(2026, 11, 15, 2, 0)) == date(2026, 11, 15)


def test_unknown_or_missing_zone_falls_back_to_server_local():
    now = utc(2026, 11, 15, 12, 0)
    expected = now.astimezone().date()
    assert learner_today(None, now) == expected
    assert learner_today("Not/AZone", now) == expected


def test_week_is_monday_to_sunday():
    assert week_bounds("UTC", date(2026, 11, 15)) == (date(2026, 11, 9), date(2026, 11, 15))    # a Sunday
    assert week_bounds("UTC", date(2026, 11, 16)) == (date(2026, 11, 16), date(2026, 11, 22))   # a Monday


def test_week_across_a_dst_change_is_still_seven_calendar_days():
    start, end = week_bounds("America/New_York", date(2026, 11, 1))    # US clocks go back on Sunday 2026-11-01
    assert (start, end) == (date(2026, 10, 26), date(2026, 11, 1))


def test_week_closes_sunday_2359_local():
    closed = week_closed_at("Pacific/Auckland", date(2026, 11, 9))
    assert (closed.year, closed.month, closed.day, closed.hour, closed.minute, closed.second) == (2026, 11, 15, 23, 59, 59)
    assert closed.utcoffset().total_seconds() == 13 * 3600
    assert closed.astimezone(timezone.utc) == utc(2026, 11, 15, 10, 59, 59)


def test_week_closed_on_the_dst_change_day_uses_that_days_offset():
    closed = week_closed_at("America/New_York", date(2026, 10, 26))   # Sunday 2026-11-01 23:59:59 is already EST (-5)
    assert closed.utcoffset().total_seconds() == -5 * 3600
