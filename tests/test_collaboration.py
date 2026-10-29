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


from lapp.services.auth import AuthService
from lapp.models.containers import Language


def _seed_language(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)


def _client_for_user(app, db, uid):
    token = AuthService().create_session(uid, remember=False)
    client = app.test_client()
    client.set_cookie('session_token', token)
    return client


def test_invite_creates_pending_collaboration(app, db):
    _seed_users(db)
    _seed_language(db)
    res = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'})
    assert res.status_code == 200
    assert res.get_json()['collaboration']['status'] == 'pending'


def test_accept_flips_status(app, db):
    _seed_users(db)
    _seed_language(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    cid = inv['collaboration']['id']
    res = _client_for_user(app, db, "user_U2").post(f'/api/collaboration/{cid}/accept')
    assert res.status_code == 200
    assert res.get_json()['collaboration']['status'] == 'accepted'


def test_reject_deletes(app, db):
    _seed_users(db)
    _seed_language(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    cid = inv['collaboration']['id']
    res = _client_for_user(app, db, "user_U2").post(f'/api/collaboration/{cid}/reject')
    assert res.status_code == 200


def test_invite_requires_owner(app, db):
    _seed_users(db)
    _seed_language(db)
    res = _client_for_user(app, db, "user_U2").post(
        '/api/collaboration', json={'collaborator_id': 'user_U1', 'target_type': 'language', 'target_id': 'lang_L1'})
    assert res.status_code == 403


from lapp.models.features import Vocabulary
from lapp.models.components import Word
from lapp.models.containers import Lesson


def _seed_vocabulary(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="L1"), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)


def test_collaborator_can_write_shared_element(app, db):
    _seed_users(db)
    _seed_vocabulary(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{inv['collaboration']['id']}/accept")
    res = _client_for_user(app, db, "user_U2").put('/api/vocabulary/voc_V1', json={'answer': 'water'})
    assert res.status_code not in (403, 404)  # collaborator is allowed to write


def test_collaborator_cannot_delete_container(app, db):
    _seed_users(db)
    _seed_language(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{inv['collaboration']['id']}/accept")
    res = _client_for_user(app, db, "user_U2").delete('/api/languages/lang_L1')
    assert res.status_code == 403


def test_collaborator_practice_writes_progress(app, db):
    _seed_users(db)
    _seed_vocabulary(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{inv['collaboration']['id']}/accept")
    res = _client_for_user(app, db, "user_U2").post(
        '/api/vocabulary/score', json={'vocabulary_id': 'voc_V1', 'score': 1.0, 'duration_ms': 100})
    assert res.status_code == 200
    with db.session_scope() as s:
        voc = s.query(Vocabulary).filter(Vocabulary.id == "voc_V1").one()
        assert voc.score == 0
        cp = s.query(CollaborationProgress).filter(
            CollaborationProgress.user_id == "user_U2", CollaborationProgress.element_id == "voc_V1").one()
        assert cp.score > 0


def test_remove_forks_content(app, db):
    _seed_users(db)
    _seed_vocabulary(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    cid = inv['collaboration']['id']
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{cid}/accept")
    res = _client_for_user(app, db, "user_U1").delete(f'/api/collaboration/{cid}')
    assert res.status_code == 200
    with db.session_scope() as s:
        langs = s.query(Language).filter(Language.user_id == "user_U2").all()
        assert len(langs) == 1
        assert langs[0].name == "Japanese"
        lessons = s.query(Lesson).filter(Lesson.language_id == langs[0].id).all()
        assert len(lessons) == 1
        vocs = s.query(Vocabulary).filter(Vocabulary.lesson_id == lessons[0].id).all()
        assert len(vocs) == 1


def test_accepted_collaboration_cannot_be_rejected(app, db):
    _seed_users(db)
    _seed_language(db)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    cid = inv['collaboration']['id']
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{cid}/accept")
    res = _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{cid}/reject")
    assert res.status_code == 403


def test_fork_dedupes_into_existing_language(app, db):
    _seed_users(db)
    _seed_vocabulary(db)  # U1 has lang_L1 (Japanese) + lesson_L1 + voc_V1
    with db.session_scope() as s:
        db.insert(Language(id="lang_L2", user_id="user_U2", name="Japanese",
                           target_iso639_2t="jpn", source_iso639_2t="eng"), session=s, commit=False)
    inv = _client_for_user(app, db, "user_U1").post(
        '/api/collaboration', json={'collaborator_id': 'user_U2', 'target_type': 'language', 'target_id': 'lang_L1'}).get_json()
    cid = inv['collaboration']['id']
    _client_for_user(app, db, "user_U2").post(f"/api/collaboration/{cid}/accept")
    res = _client_for_user(app, db, "user_U1").delete(f'/api/collaboration/{cid}')
    assert res.status_code == 200
    with db.session_scope() as s:
        langs = s.query(Language).filter(Language.user_id == "user_U2").all()
        assert len(langs) == 1  # no duplicate "Japanese" created
        assert langs[0].id == "lang_L2"  # merged into the existing one
