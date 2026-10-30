"""Seed helpers for the DB-backed ingestion tests (need Postgres, like the rest of the suite)."""
from lapp.models.containers import Language, Lesson
from lapp.models.system_data import User, UserPreferences
from lapp.services.auth import AuthService

TEXT_ENDPOINT = {"name": "ds", "api_type": "text_gen", "base_url": "https://api.deepseek.com/v1",
                 "api_key": "k", "model": "deepseek-chat", "is_active": True}
OCR_ENDPOINT = {"name": "vision", "api_type": "ocr", "base_url": "https://api.openai.com/v1",
                "api_key": "k", "model": "gpt-4o", "is_active": True}


def make_user(db, uid, endpoints=(TEXT_ENDPOINT,)):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com"), session=s, commit=False)
        db.insert(UserPreferences(id=f"pref_{uid}", user_id=uid, ai_endpoints=list(endpoints)),
                  session=s, commit=False)


def make_language(db, uid, lang_id="lang_L1", lesson_id="lesson_L1"):
    with db.session_scope() as s:
        db.insert(Language(id=lang_id, user_id=uid, name=f"French {lang_id}", target_iso639_2t="fra",
                           source_iso639_2t="eng"), session=s, commit=False)
        db.insert(Lesson(id=lesson_id, user_id=uid, language_id=lang_id, title="L1"), session=s, commit=False)


def client_for(app, uid):
    client = app.test_client()
    client.set_cookie('session_token', AuthService().create_session(uid, remember=False))
    return client
