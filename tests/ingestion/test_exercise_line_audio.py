from pathlib import Path

import pytest

from lapp.models.features import Exercise
from lapp.services import ExerciseService
from lapp.services.tts import TTSService
from ingestion_seeds import TEXT_ENDPOINT, client_for, make_language, make_user

TTS_ENDPOINT = {"name": "tts", "api_type": "tts", "base_url": "https://tts.example/v1", "api_key": "k", "model": "m", "is_active": True}
CONTENT = {"lines": [{"text": "犬がいます", "audioIndex": None}, {"text": "猫もいます", "audioIndex": None}]}


def _setup(app, db, endpoints=(TEXT_ENDPOINT, TTS_ENDPOINT), exercise_type="dictation"):
    make_user(db, "user_U1", endpoints=endpoints)
    make_language(db, "user_U1")
    with db.session_scope() as s:
        db.insert(Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type=exercise_type, question="Write", answer="犬がいます 猫もいます",
                           content=CONTENT, audio_files=[]), session=s, commit=False)
    return client_for(app, "user_U1")


@pytest.fixture
def tts(app, monkeypatch):
    calls = []

    def fake(self, text, language_code=None, api=None):
        calls.append((text, language_code, api["base_url"]))
        folder = Path(app.config["MEDIA_ROOT"]) / "audio"      # the model only keeps clips that exist on disk
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"line_audio_test_{len(calls)}.wav").write_bytes(b"RIFF")
        return f"/{Path(app.config['MEDIA_ROOT']).name}/audio/line_audio_test_{len(calls)}.wav"

    monkeypatch.setattr(TTSService, "generate_audio", fake)
    monkeypatch.setattr(TTSService, "__init__", lambda self, media_root=None: None)
    return calls


def test_a_line_gets_a_clip_from_the_users_tts_endpoint_and_it_is_stored(app, db, tts):
    client = _setup(app, db)
    res = client.post("/api/exercise/ex_E1/line-audio", json={"line": 1})
    assert res.status_code == 200
    assert tts == [("猫もいます", "fr", "https://tts.example/v1")]   # the seeded language is French (fra)
    body = res.get_json()
    assert body["audio_files"] == ["/media_test/audio/line_audio_test_1.wav"] and body["content"]["lines"][1]["audioIndex"] == 0
    stored = ExerciseService().get_by_id("ex_E1", as_dict=True, include_relations=False)
    assert stored["audio_files"] == ["/media_test/audio/line_audio_test_1.wav"] and stored["content"]["lines"][0]["audioIndex"] is None


def test_a_line_that_already_has_a_clip_is_not_generated_again(app, db, tts):
    client = _setup(app, db)
    client.post("/api/exercise/ex_E1/line-audio", json={"line": 0})
    again = client.post("/api/exercise/ex_E1/line-audio", json={"line": 0})
    assert again.status_code == 200 and len(tts) == 1


def test_no_tts_endpoint_is_a_409_not_a_crash(app, db, tts):
    client = _setup(app, db, endpoints=(TEXT_ENDPOINT,))
    res = client.post("/api/exercise/ex_E1/line-audio", json={"line": 0})
    assert res.status_code == 409 and res.get_json()["error"] == "tts_not_configured" and not tts


def test_a_failing_endpoint_is_a_502_and_stores_nothing(app, db, monkeypatch):
    def boom(self, **kw):
        raise RuntimeError("401")
    monkeypatch.setattr(TTSService, "__init__", lambda self, media_root=None: None)
    monkeypatch.setattr(TTSService, "generate_audio", boom)
    client = _setup(app, db)
    res = client.post("/api/exercise/ex_E1/line-audio", json={"line": 0})
    assert res.status_code == 502 and res.get_json()["error"] == "tts_failed"
    assert ExerciseService().get_by_id("ex_E1", as_dict=True, include_relations=False)["audio_files"] == []


def test_other_exercise_types_and_bad_lines_are_400(app, db, tts):
    client = _setup(app, db, exercise_type="essay")
    assert client.post("/api/exercise/ex_E1/line-audio", json={"line": 0}).status_code == 400


def test_a_line_index_out_of_range_is_400(app, db, tts):
    client = _setup(app, db)
    assert client.post("/api/exercise/ex_E1/line-audio", json={"line": 9}).status_code == 400
    assert client.post("/api/exercise/ex_E1/line-audio", json={"line": "0"}).status_code == 400
