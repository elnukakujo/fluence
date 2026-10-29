"""Score model: per-user current state, unique (user_id, element_id)."""
import pytest
from sqlalchemy.exc import IntegrityError

from lapp.models.system_data import Score, User


def _seed_user(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_score_field_defaults(db):
    _seed_user(db)
    s = db.get_session()
    try:
        s.add(Score(id="sc_S1", user_id="user_U1", element_id="voc_V1"))
        s.flush()
        row = s.query(Score).filter(Score.id == "sc_S1").one()
        assert row.score == 0.0
        assert row.difficulty == 0.5
    finally:
        s.rollback()
        s.close()


def test_score_unique_user_element(db):
    _seed_user(db)
    s = db.get_session()
    try:
        s.add(Score(id="sc_S1", user_id="user_U1", element_id="voc_V1"))
        s.add(Score(id="sc_S2", user_id="user_U1", element_id="voc_V1"))
        with pytest.raises(IntegrityError) as e:
            s.flush()
        assert "uq_score_user_element" in str(e.value)
    finally:
        s.rollback()
        s.close()
