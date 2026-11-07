from types import SimpleNamespace

from lapp.models.features.exercise import Exercise


def _ex(t, content, files):
    # the property only reads three attributes; a plain namespace avoids needing an app context
    return SimpleNamespace(needs=Exercise.needs.fget(SimpleNamespace(exercise_type=t, content=content, audio_files=files, review_reason=None)))


def test_dictation_needs_audio_until_every_line_has_a_clip():
    lines = [{"text": "a", "audioIndex": 0}, {"text": "b", "audioIndex": None}]
    assert _ex("dictation", {"lines": lines}, ["/m/a.wav"]).needs == ["audio"]
    lines[1]["audioIndex"] = 1
    assert _ex("dictation", {"lines": lines}, ["/m/a.wav"]).needs == ["audio"]   # index out of range
    assert _ex("dictation", {"lines": lines}, ["/m/a.wav", "/m/b.wav"]).needs == []


def test_other_types_are_always_ready():
    assert _ex("reading", {"lines": [{"text": "a", "audioIndex": None}]}, []).needs == []
    assert _ex("essay", None, []).needs == []
