"""AuthService + UserSession tests (Task 1 + Task 4)."""


def test_user_session_roundtrip(db):
    from lapp.models.system_data import User, UserSession

    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(UserSession(id="sess_S1", user_id="user_U1", token_hash="abc"), session=s, commit=False)

    with db.session_scope() as s:
        row = db.find_by_attr(UserSession, {"token_hash": "abc"}, session=s)
        assert row is not None and row.user_id == "user_U1"
