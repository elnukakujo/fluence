import logging
import uuid
from pathlib import Path

from ..utils import synthesize_speech, detect_text_language

logger = logging.getLogger(__name__)

# Verified against http://192.168.1.139:8880/voices (Kokoro server)
# Convention: {lang}_{gender} — en_f, en_m, es_f, es_m, etc.
_VOICE_MAP: dict[str, dict[str, str]] = {
    "en": {"female": "en_f", "male": "en_m"},
    "es": {"female": "es_f", "male": "es_m"},
    "fr": {"female": "fr_f"},                          # no male voice
    "ja": {"female": "ja_f", "male": "ja_m"},
    "zh": {"female": "zh_f", "male": "zh_m"},
    "hi": {"female": "hi_f"},                          # no male voice
    "it": {"female": "it_f"},                          # no male voice
    "pt": {"female": "pt_f"},                          # no male voice
}
_VOICE_FALLBACK = "en_f"

# ElevenLabs multilingual voice ids (work across languages via eleven_multilingual_v2).
_ELEVENLABS_VOICES: dict[str, str] = {
    "female": "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "male": "pNInz6obpgDQGcFmaJgB",     # Adam
}

# Google Cloud TTS language codes (ISO 639-1 -> BCP-47). Falls back to en-US.
_GOOGLE_LANG_MAP: dict[str, str] = {
    "ja": "ja-JP", "en": "en-US", "es": "es-ES", "fr": "fr-FR",
    "zh": "cmn-CN", "hi": "hi-IN", "it": "it-IT", "pt": "pt-BR",
    "de": "de-DE", "ko": "ko-KR", "ru": "ru-RU", "ar": "ar-XA",
    "nl": "nl-NL", "pl": "pl-PL", "tr": "tr-TR", "vi": "vi-VN",
}

class TTSService:
    """
    Service for generating text-to-speech audio via a configurable TTS API endpoint.

    This service handles:
    - Audio generation via LAPP_TTS_API_BASE_URL
    - Integration with MediaService/MediaFileHandler
    - File management and storage
    - Error handling and logging
    """
    def __init__(self, media_root: str = None):
        from .media import MediaService
        self.media_root = Path(media_root if media_root else MediaService().media_root)
        self.audio_dir = self.media_root / 'audio'
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def _get_filename(self) -> str:
        """
        Get filename for TTS audio file.
        
        Returns:
            Filename where audio should be saved
        """
        return f"{uuid.uuid4().hex}.wav"
    
    def _get_relative_path(self, full_path: Path) -> str:
        """
        Get relative path from media root with forward slashes (cross-platform).
        
        Args:
            full_path: Full file path
            
        Returns:
            Relative path with forward slashes (e.g., '/media/audio/file.wav' or '/media_dev/audio/file.wav' or '/media_test/audio/file.wav')
        """
        # Get relative path and convert to POSIX format (forward slashes)
        relative = full_path.relative_to(self.media_root)
        # Always return with correct prefix and forward slashes
        return f"/{self.media_root.name}/{relative.as_posix()}"
    
    def generate_audio(
        self,
        text: str,
        language_code: str = None,
        api: dict | None = None,
    ) -> str | list[str]:
        """
        Generate audio file from text using the configured TTS API endpoint.
        
        Args:
            text: Text to convert to speech (string)
        
        Returns:
            Relative path to generated audio file with forward slashes
            (e.g., '/media/audio/abc123.wav')
        
        Raises:
            ValueError: If text is empty
            Exception: For other errors
        """
        # Validation
        if not text:
            raise ValueError("Text cannot be empty")

        if not api or not api.get("base_url"):
            raise ValueError("No TTS API configured for this user")

        try:
            logger.info(f"Generating TTS for: {text}")

            # Voice resolution: explicit override > target-language > language+gender > language-female > fallback.
            # Prefer the caller's target language over guessing from the text —
            # single CJK chars like 犬 are shared across ja/zh and langdetect misreads them.
            if not api.get("voice"):
                api_format = api.get("api_format")
                is_elevenlabs = api_format == "elevenlabs"
                is_google = api_format == "google_tts"
                try:
                    gender = api.get("voice_gender") or "female"
                    if is_elevenlabs:
                        # ElevenLabs voices are multilingual ids, not per-language names.
                        voice = _ELEVENLABS_VOICES.get(gender) or _ELEVENLABS_VOICES["female"]
                        logger.info(f"Selected ElevenLabs voice '{voice}' (gender={gender})")
                    elif is_google:
                        # Google voices are per-language; `voice` carries the BCP-47 code,
                        # gender is handled downstream via voice_gender.
                        iso1 = language_code or detect_text_language(text).iso1
                        voice = _GOOGLE_LANG_MAP.get(iso1, "en-US")
                        logger.info(f"Selected Google language code '{voice}' (lang={iso1})")
                    else:
                        iso1 = language_code or detect_text_language(text).iso1
                        voices = _VOICE_MAP.get(iso1, {})
                        # ponytail: if male voice doesn't exist for this language, fall back to female
                        voice = voices.get(gender) or voices.get("female") or _VOICE_FALLBACK
                        logger.info(f"Selected voice '{voice}' (lang={iso1}, gender={gender})")
                    api = {**api, "voice": voice}
                except Exception:
                    if is_elevenlabs:
                        fallback = _ELEVENLABS_VOICES["female"]
                    elif is_google:
                        fallback = "en-US"
                    else:
                        fallback = _VOICE_FALLBACK
                    api = {**api, "voice": fallback}
                    logger.info(f"Voice detection failed, using fallback '{fallback}'")

            wav_bytes = synthesize_speech(**api, text=text)

            generated_paths = []
            filename = self._get_filename()
            output_path = self.audio_dir / filename
            output_path.write_bytes(wav_bytes)

            # Get normalized path with forward slashes
            relative_path = self._get_relative_path(output_path)
            generated_paths.append(relative_path)
            
            logger.info(f"✅ Generated TTS audio: {filename} for text: '{text}'")
            
            # Return single path if input was single string, else return list
            return generated_paths[0] if isinstance(text, str) else generated_paths
            
        except Exception as e:
            logger.error(f"❌ Failed to generate audio for '{text}': {e}")
            raise