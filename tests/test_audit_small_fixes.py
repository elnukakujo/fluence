"""Small fixes from the 2026-11-23 audit: each one fails without its change."""
import io
from datetime import datetime, timedelta, timezone

import httpx

from lapp.api.routes.ingestion import _page_ranges
from lapp.models.components import Word
from lapp.models.containers import Language, Lesson
from lapp.models.features import Exercise, Grammar, Vocabulary
from lapp.models.system_data import Score, User
from lapp.services.auth import AuthService
from lapp.services.containers import LanguageService, LessonService
from lapp.services.system_data import ScoreService
from lapp.utils.llm_providers import auth_headers
from lapp.utils.model_api import ModelAPIError
from lapp.utils.scoring import _local_day


def _login(app, db, uid="user_U1", **kw):
    with db.session_scope() as s:
        db.insert(User(id=uid, username=uid, email=f"{uid}@x.com", **kw), session=s, commit=False)
    c = app.test_client()
    c.set_cookie("session_token", AuthService().create_session(uid, remember=False))
    return c


def _course(db):
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="l"), session=s, commit=False)
        db.insert(Lesson(id="lesson_L1", user_id="user_U1", language_id="lang_L1", title="t", position=0), session=s, commit=False)
        db.insert(Word(id="word_W1", language_id="lang_L1", word="水"), session=s, commit=False)
        db.insert(Vocabulary(id="voc_V1", lesson_id="lesson_L1", word_id="word_W1"), session=s, commit=False)
        db.insert(Grammar(id="gram_G1", lesson_id="lesson_L1", title="g", explanation="e"), session=s, commit=False)
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="true_false", question="q", answer="a"), session=s, commit=False)


def _scores(db):
    with db.session_scope() as s:
        return s.query(Score).count()


def _record_all(db):
    for element, skill in (("voc_V1", "recall"), ("gram_G1", "recognition"), ("ex_E1", "recall")):
        ScoreService().record("user_U1", element, skill, 1.0, "typed")


def test_deleting_a_lesson_drops_the_scores_of_its_elements(app, db):
    _login(app, db)
    _course(db)
    _record_all(db)
    assert _scores(db) > 0
    assert LessonService().delete("lesson_L1") is True
    assert _scores(db) == 0


def test_deleting_a_language_drops_the_scores_of_its_lessons_elements(app, db):
    _login(app, db)
    _course(db)
    _record_all(db)
    assert LanguageService().delete("lang_L1") is True
    assert _scores(db) == 0


def test_a_note_only_goes_on_a_studied_element(app, db):
    c = _login(app, db)
    _course(db)
    assert c.put("/api/review/note/word_W1", json={"note": "x"}).status_code == 400
    assert c.put("/api/review/note/voc_V1", json={"note": "x"}).status_code == 200


def test_evaluate_an_exercise_that_is_not_yours_is_refused_not_a_200(app, db):
    _login(app, db)
    _course(db)
    other = _login(app, db, "user_U2")
    assert other.post("/api/evaluate/text", json={"exercise_id": "ex_E1", "user_text": "a"}).status_code == 403


def test_a_lesson_post_with_an_id_in_the_body_is_not_a_500(app, db):
    c = _login(app, db)
    _course(db)
    r = c.post("/api/lessons/", json={"id": "lesson_Z9", "title": "n", "language_id": "lang_L1"})
    assert r.status_code in (200, 201)


def test_an_upload_over_the_limit_is_refused_before_it_is_read(app, db):
    c = _login(app, db)
    app.config["MAX_IMAGE_SIZE"] = 1000
    big = (io.BytesIO(b"x" * (2 * 1024 * 1024)), "a.png")
    assert c.post("/media/upload/image", data={"file": big}, content_type="multipart/form-data").status_code == 413


def test_an_upload_without_a_filename_is_a_400_not_a_500(app, db):
    c = _login(app, db)
    r = c.post("/media/upload/image", data={"file": (io.BytesIO(b"x"), "")}, content_type="multipart/form-data")
    assert r.status_code == 400


def test_a_superscript_page_number_is_an_error_message_not_a_crash():
    ranges, error = _page_ranges({"page_from": "²", "page_to": "3"})
    assert ranges is None and error


def test_the_gain_cap_day_is_the_learners_even_for_a_naive_now():
    tz = timezone(timedelta(hours=14))
    naive = datetime(2026, 1, 1, 12, 0)
    assert _local_day(naive, tz) == naive.astimezone(tz).date()


def test_a_read_timeout_with_no_message_is_reported_as_a_timeout():
    err = ModelAPIError.from_connection(httpx.ReadTimeout(""), "http://x")
    assert "timed out" in err.message


def test_the_api_key_param_joins_an_existing_query_string():
    assert auth_headers("https://h/p?a=1", "K", "param")[0] == "https://h/p?a=1&key=K"
    assert auth_headers("https://h/p", "K", "param")[0] == "https://h/p?key=K"
