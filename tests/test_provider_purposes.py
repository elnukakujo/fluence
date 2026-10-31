from lapp.utils.llm_providers import PROVIDER_LIST


def _for(purpose):
    return {p["value"] for p in PROVIDER_LIST if purpose in p["purposes"]}


def test_every_provider_has_a_purpose():
    assert all(p["purposes"] for p in PROVIDER_LIST)


def test_text_gen_has_no_speech_or_ocr_only_providers():
    text = _for("text_gen")
    assert not text & {"elevenlabs", "google_tts", "local_tts", "mistral_ocr"}
    assert {"deepseek", "openai", "anthropic"} <= text


def test_tts_and_ocr_lists_are_tailored():
    assert _for("tts") == {"openai", "elevenlabs", "google_tts", "local_tts", "custom"}
    assert "deepseek" not in _for("ocr") and "mistral" not in _for("ocr") and "mistral_ocr" in _for("ocr")
    assert "elevenlabs" not in _for("ocr")
