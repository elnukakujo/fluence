"""Media, backup and ingestion files need a session (Review Focus 1: no cookie, wrong cookie, expired session)."""
import pytest

from lapp.models.system_data import User
from lapp.services.auth import AuthService

OPEN_BEFORE = [
    ("get", "/media/images/a.png"),
    ("get", "/media/ingestion/job_1/doc.pdf"),
    ("get", "/media/info/images/a.png"),
    ("post", "/media/upload/image"),
    ("post", "/media/upload/audio"),
    ("delete", "/media/delete/"),
    ("get", "/api/backup/list"),
    ("get", "/api/backup/info"),
    ("post", "/api/backup/create"),
    ("post", "/api/backup/cleanup"),
]


def _client(app, db, uid, token=None, **kw):
    c = app.test_client()
    if token is None:
        with db.session_scope() as s:
            db.insert(User(id=uid, username=uid, email=f"{uid}@x.com", **kw), session=s, commit=False)
        token = AuthService().create_session(uid, remember=False)
    c.set_cookie("session_token", token)
    return c


@pytest.mark.parametrize("method,url", OPEN_BEFORE)
def test_no_cookie_is_401(app, db, method, url):
    assert getattr(app.test_client(), method)(url).status_code == 401


@pytest.mark.parametrize("method,url", OPEN_BEFORE)
def test_expired_or_unknown_session_is_401(app, db, method, url):
    assert getattr(_client(app, db, "user_X", token="not-a-real-token"), method)(url).status_code == 401


@pytest.mark.parametrize("method,url", [m for m in OPEN_BEFORE if m[1].startswith("/api/backup")])
def test_backup_is_admin_only(app, db, method, url):
    assert getattr(_client(app, db, "user_U1"), method)(url).status_code == 403


def test_private_folders_are_never_served(app, db, tmp_path):
    app.config["MEDIA_ROOT"] = str(tmp_path)
    (tmp_path / "ingestion" / "job_1").mkdir(parents=True)
    (tmp_path / "ingestion" / "job_1" / "doc.pdf").write_bytes(b"x")
    (tmp_path / "parse_cache").mkdir()
    (tmp_path / "parse_cache" / "c.json").write_bytes(b"{}")
    c = _client(app, db, "user_U1")
    assert c.get("/media/ingestion/job_1/doc.pdf").status_code == 404
    assert c.get("/media/parse_cache/c.json").status_code == 404
