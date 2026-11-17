"""GET /api/backup/download/<file> — admin-only download of a backup dump."""
from lapp.services.auth import AuthService
from lapp.models.system_data import User

NAME = "backup_fluence_test_20260101_120000.dump"


def _client(app, db, uid, **kw):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com", **kw), session=s, commit=False)
    c = app.test_client()
    c.set_cookie('session_token', AuthService().create_session(uid, remember=False))
    return c


def _dump(app, tmp_path):
    (tmp_path / NAME).write_bytes(b"PGDMP-bytes")
    app.backup_manager.backup_dir = tmp_path


def test_admin_downloads_backup(app, db, tmp_path):
    _dump(app, tmp_path)
    res = _client(app, db, "user_A1", is_admin=True).get(f"/api/backup/download/{NAME}")
    assert res.status_code == 200
    assert res.data == b"PGDMP-bytes"
    assert NAME in res.headers["Content-Disposition"]


def test_non_admin_forbidden(app, db, tmp_path):
    _dump(app, tmp_path)
    assert _client(app, db, "user_U2").get(f"/api/backup/download/{NAME}").status_code == 403


def test_anonymous_unauthorized(app, tmp_path):
    _dump(app, tmp_path)
    assert app.test_client().get(f"/api/backup/download/{NAME}").status_code == 401


def test_rejects_bad_names_and_missing(app, db, tmp_path):
    _dump(app, tmp_path)
    c = _client(app, db, "user_A1", is_admin=True)
    assert c.get("/api/backup/download/passwd.txt").status_code == 400
    assert c.get("/api/backup/download/..%2Fbackup_x.dump").status_code in (400, 404)
    assert c.get("/api/backup/download/backup_fluence_nope.dump").status_code == 404
