"""No built-in TTS (DM-39); audio is optional per item (OA-4)."""
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from lapp.services.audio import exercise_type_offered, item_has_audio
from lapp.services.exercise_generation.planner import offerable_types
from lapp.services.tts import TTSService

SRC = Path(__file__).resolve().parents[1] / "src" / "lapp"


def test_no_module_carries_a_built_in_voice_table():
    offenders = [str(p.relative_to(SRC)) for p in SRC.rglob("*.py")
                 if "graphify" not in str(p) and re.search(r"_VOICE_MAP|_VOICE_FALLBACK|8880/voices", p.read_text())]
    assert offenders == []


def test_item_has_audio():
    assert item_has_audio(SimpleNamespace(audio_files=["/media/audio/a.mp3"]))
    assert not item_has_audio(SimpleNamespace(audio_files=[])) and not item_has_audio(SimpleNamespace(audio_files=None))


def test_dictation_is_offered_only_when_clips_can_be_made():
    assert not exercise_type_offered("dictation", tts_available=False)
    assert exercise_type_offered("dictation", tts_available=True)
    assert exercise_type_offered("translate", tts_available=False)
    assert "dictation" not in offerable_types({}, tts_enabled=False) and "dictation" in offerable_types({}, tts_enabled=True)
    assert "translate" in offerable_types({}, tts_enabled=False)          # everything that needs no audio stays on


def test_a_plain_endpoint_without_a_voice_is_refused_not_given_a_default(tmp_path):
    api = {"base_url": "http://tts.test", "model": "m", "api_key": "", "api_format": "openai", "auth_type": "none"}
    with pytest.raises(ValueError, match="No voice"):
        TTSService(media_root=str(tmp_path)).generate_audio("bonjour", language_code="fr", api=api)
