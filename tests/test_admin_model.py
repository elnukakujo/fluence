"""Admin model + single-admin enforcement tests (Task 2 + Task 6)."""
import pytest

from lapp.services.system_data import UserService
from lapp.schemas.system_data import UserDict
from lapp.models.system_data import User


def _make_user(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_user_auth_fields_default(db):
    _make_user(db)
    with db.session_scope() as s:
        user = db.find_by_attr(User, {"id": "user_U1"}, session=s)
        assert user.is_admin is False
        assert user.blocked is False
        assert user.last_login_at is None


def test_user_to_dict_includes_auth_fields(db):
    _make_user(db)
    with db.session_scope() as s:
        user = db.find_by_attr(User, {"id": "user_U1"}, session=s)
        d = user.to_dict()
        assert "is_admin" in d and d["is_admin"] is False
        assert "blocked" in d and d["blocked"] is False
        assert "last_login_at" in d and d["last_login_at"] is None


def _create_user(username, email, password="secret"):
    return UserService().create(UserDict(username=username, email=email, password=password), as_dict=True)


def test_first_user_is_admin(db):
    u = _create_user("first", "first@x.com")
    assert u["is_admin"] is True


def test_second_user_not_admin(db):
    _create_user("first", "first@x.com")
    u2 = _create_user("second", "second@x.com")
    assert u2["is_admin"] is False


def test_cannot_demote_last_admin(db):
    admin = _create_user("first", "first@x.com")
    with pytest.raises(ValueError):
        UserService().update(admin["id"], UserDict(is_admin=False))


def test_cannot_create_second_admin(db):
    _create_user("first", "first@x.com")
    u2 = _create_user("second", "second@x.com")
    with pytest.raises(ValueError):
        UserService().update(u2["id"], UserDict(is_admin=True))


def test_set_blocked(db):
    u = _create_user("first", "first@x.com")
    assert UserService().set_blocked(u["id"], True) is True
    with db.session_scope() as s:
        user = db.find_by_attr(User, {"id": u["id"]}, session=s)
        assert user.blocked is True
