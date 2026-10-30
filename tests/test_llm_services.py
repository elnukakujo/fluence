"""Service-level tests for LLM services with mocked model API."""
import pytest
from unittest.mock import patch

from lapp.services.text_gen import TextGeneratorService
from lapp.services.tts import TTSService

API = {"base_url": "http://llm:8080/v1", "api_key": "k", "model": "m"}
GEN = TextGeneratorService()


@pytest.mark.parametrize("method,kwargs", [
    ("generate_learnable_sentence", {"grammar_sheet": "Use 第 + number", "source_lang_code": "fra", "target_lang_code": "zho"}),
    ("generate_example_sentence", {"vocabulary_word": "吃饭", "source_lang_code": "eng", "target_lang_code": "zho"}),
    ("generate_example_word", {"character": "学", "source_lang_code": "eng", "target_lang_code": "zho"}),
])
def test_text_gen_success(method, kwargs):
    with patch("lapp.services.text_gen.chat_completion", return_value="这是我第二次来中国。") as mock:
        result = getattr(GEN, method)(api=API, **kwargs)
    assert result == "这是我第二次来中国。"
    # final message in the list is the real user prompt, not a few-shot example
    assert mock.call_args.kwargs["messages"][-1]["role"] == "user"


def test_text_gen_missing_api_returns_empty():
    with patch("lapp.services.text_gen.chat_completion") as mock:
        assert GEN.generate_learnable_sentence(
            grammar_sheet="x", source_lang_code="fra", target_lang_code="zho", api={}
        ) == ""
        assert GEN.generate_example_sentence(
            vocabulary_word="x", source_lang_code="eng", target_lang_code="zho", api=None
        ) == ""
    mock.assert_not_called()


def test_text_gen_strips_think_tags():
    with patch("lapp.services.text_gen.chat_completion",
               return_value="<think>let me reason</think>这是我第二次来中国。"):
        result = GEN.generate_learnable_sentence(
            grammar_sheet="x", source_lang_code="fra", target_lang_code="zho", api=API
        )
    assert result == "这是我第二次来中国。"


def test_text_gen_error_propagates():
    with patch("lapp.services.text_gen.chat_completion", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            GEN.generate_learnable_sentence(
                grammar_sheet="x", source_lang_code="fra", target_lang_code="zho", api=API
            )


def test_tts_success_writes_wav(tmp_path):
    with patch("lapp.services.tts.synthesize_speech", return_value=b"wav-bytes") as mock:
        path = TTSService(media_root=str(tmp_path)).generate_audio(text="hello", api=API)
    filename = path.rsplit("/", 1)[-1]
    assert path == f"/{tmp_path.name}/audio/{filename}"
    assert (tmp_path / "audio" / filename).read_bytes() == b"wav-bytes"
    mock.assert_called_once_with(
        base_url=API["base_url"], api_key=API["api_key"], model=API["model"], voice="en_f", text="hello"
    )


def test_tts_empty_text_raises(tmp_path):
    with pytest.raises(ValueError, match="empty"):
        TTSService(media_root=str(tmp_path)).generate_audio(text="", api=API)


def test_tts_missing_api_raises(tmp_path):
    with pytest.raises(ValueError, match="TTS API"):
        TTSService(media_root=str(tmp_path)).generate_audio(text="hello", api={})


def test_tts_error_propagates(tmp_path):
    with patch("lapp.services.tts.synthesize_speech", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            TTSService(media_root=str(tmp_path)).generate_audio(text="hello", api=API)
