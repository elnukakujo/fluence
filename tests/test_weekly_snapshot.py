from datetime import date, datetime, timezone

from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.data_collection import WeeklySnapshot
from lapp.models.features import Vocabulary
from lapp.models.system_data import User
from lapp.services.data_collection.weekly_snapshot import WeeklySnapshotService

U = "user_U1"


def _seed(db):
    with db.session_scope() as s:
        db.insert(User(id=U, username="a", email="a@x.com"), session=s, commit=False)
        s.flush()
        db.insert(Language(id="lang_W", user_id=U, name="W", target_iso639_2t="jpn"), session=s, commit=False)
        db.insert(Lesson(id="lesson_W", user_id=U, language_id="lang_W", title="W", position=0), session=s, commit=False)
        for i in range(3):
            db.insert(Word(id=f"word_W{i}", language_id="lang_W", word=f"w{i}"), session=s, commit=False)
            db.insert(Vocabulary(id=f"voc_W{i}", lesson_id="lesson_W", word_id=f"word_W{i}"), session=s, commit=False)


def test_close_week_is_idempotent_and_counts_total(db):
    _seed(db)
    svc = WeeklySnapshotService()
    a = svc.close_week(U, "lang_W", date(2026, 11, 2), "UTC")
    b = svc.close_week(U, "lang_W", date(2026, 11, 2), "UTC")
    assert a.id == b.id and a.n_total == 3 and a.n_seen == 0
    with db.session_scope() as s:
        assert s.query(WeeklySnapshot).count() == 1


def test_catch_up_fills_gap_once(db):
    _seed(db)
    svc = WeeklySnapshotService()
    svc.close_week(U, "lang_W", date(2026, 10, 12), "UTC")
    now = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)         # Wednesday: last closed week starts Nov 2
    written = svc.catch_up(U, "UTC", now=now)
    assert [w.week_start for w in written] == [date(2026, 10, 19), date(2026, 10, 26), date(2026, 11, 2)]
    assert svc.catch_up(U, "UTC", now=now) == []
