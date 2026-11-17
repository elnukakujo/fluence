"""An exercise that needs audio and has none is skipped on its own; typed recall of the same word still queues."""
import lapp.services  # noqa: F401
from lapp.models.features import Exercise


def _dictation(files, lines):
    return Exercise(id="ex_E1", lesson_id="lesson_L1", exercise_type="dictation", question="q", answer="a",
                    content={"lines": lines}, audio_files=files)


def test_dictation_without_clips_needs_audio_and_with_clips_does_not(db):
    lines = [{"text": "bonjour", "audioIndex": 0}]
    assert "audio" in _dictation([], lines).needs
    assert "audio" not in _dictation(["/media/audio/a.mp3"], lines).needs


def test_one_missing_clip_blocks_only_that_exercise(db):
    ok = _dictation(["/media/audio/a.mp3"], [{"text": "a", "audioIndex": 0}])
    missing = _dictation(["/media/audio/a.mp3"], [{"text": "a", "audioIndex": 0}, {"text": "b", "audioIndex": 1}])
    assert "audio" not in ok.needs and "audio" in missing.needs
