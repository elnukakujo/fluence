"""ScoreService: per-user record/get/get_many."""
from lapp.services.system_data import ScoreService
from lapp.models.system_data import User
from lapp.utils.helpers import status_for


def _seed_users(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)


def test_record_creates_then_evolves(db):
    _seed_users(db)
    s = ScoreService().record("user_U1", "voc_V1", 0.8)
    assert s.score > 0.0
    created_at = s.created_at
    s2 = ScoreService().record("user_U1", "voc_V1", 0.8)
    assert s2.id == s.id          # same row, not a new one
    assert s2.created_at == created_at  # created_at stable
    assert s2.score >= s.score


def test_record_isolation(db):
    _seed_users(db)
    ScoreService().record("user_U1", "voc_V1", 0.9)
    ScoreService().record("user_U2", "voc_V1", 0.1)
    assert ScoreService().get("user_U1", "voc_V1").score != \
           ScoreService().get("user_U2", "voc_V1").score


def test_get_many(db):
    _seed_users(db)
    ScoreService().record("user_U1", "voc_V1", 0.9)
    ScoreService().record("user_U1", "voc_V2", 0.8)
    m = ScoreService().get_many("user_U1", ["voc_V1", "voc_V2", "voc_V9"])
    assert m["voc_V1"].score > 0.0
    assert m["voc_V2"].score > 0.0
    assert "voc_V9" not in m   # unstarted → no row


def test_merge_attaches_score(db):
    _seed_users(db)
    ScoreService().record("user_U1", "voc_V1", 0.8)
    out = ScoreService().merge("user_U1", [{"id": "voc_V1"}, {"id": "voc_V9"}])
    assert out[0]["score"] > 0.0
    assert out[0]["status"] == status_for("voc_V1", out[0]["score"])
    assert out[1]["score"] == 0.0          # unstarted default
    assert out[1]["difficulty"] == 0.5
    assert out[1]["status"] == "unstarted"
