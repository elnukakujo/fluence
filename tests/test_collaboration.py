"""Collaboration: models, service/routes, write access, per-user scoring, fork, dedupe."""
from lapp.models.system_data import Collaboration, CollaborationProgress, User


def _seed_users(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com", is_admin=True), session=s, commit=False)
        db.insert(User(id="user_U2", username="b", email="b@x.com"), session=s, commit=False)


def test_collaboration_model_fields(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(Collaboration(id="collab_C1", master_id="user_U1", collaborator_id="user_U2",
                                target_type="language", target_id="lang_L1", status="pending"), session=s, commit=False)
        s.flush()
        c = s.query(Collaboration).filter(Collaboration.id == "collab_C1").one()
        assert c.master_id == "user_U1" and c.status == "pending"


def test_collaboration_progress_model_fields(db):
    _seed_users(db)
    with db.session_scope() as s:
        db.insert(CollaborationProgress(id="cp_P1", user_id="user_U2", element_id="voc_V1",
                                        score=42.0, difficulty=0.6), session=s, commit=False)
        s.flush()
        p = s.query(CollaborationProgress).filter(CollaborationProgress.id == "cp_P1").one()
        assert p.score == 42.0 and p.difficulty == 0.6
