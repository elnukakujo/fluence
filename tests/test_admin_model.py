"""Admin model + single-admin enforcement tests (Task 2 + Task 6)."""


def _make_user(db):
    from lapp.models.system_data import User
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_user_auth_fields_default(db):
    _make_user(db)
    from lapp.models.system_data import User
    with db.session_scope() as s:
        user = db.find_by_attr(User, {"id": "user_U1"}, session=s)
        assert user.is_admin is False
        assert user.blocked is False
        assert user.last_login_at is None


def test_user_to_dict_includes_auth_fields(db):
    _make_user(db)
    from lapp.models.system_data import User
    with db.session_scope() as s:
        user = db.find_by_attr(User, {"id": "user_U1"}, session=s)
        d = user.to_dict()
        assert "is_admin" in d and d["is_admin"] is False
        assert "blocked" in d and d["blocked"] is False
        assert "last_login_at" in d and d["last_login_at"] is None
