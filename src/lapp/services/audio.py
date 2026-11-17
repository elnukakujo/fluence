"""Audio is optional (DM-39, OA-4): it comes from the learner's TTS endpoint or from files they attached, never from a built-in voice.
An item that needs audio and has none is skipped on its own (see `Exercise.needs`); the rest of the lesson is unaffected."""

AUDIO_TYPES = frozenset({"dictation"})        # exercise types that cannot run without a clip per line


def item_has_audio(element) -> bool:
    """True when the element (word, vocabulary, exercise…) carries at least one audio file."""
    return bool(getattr(element, "audio_files", None))


def exercise_type_offered(exercise_type: str, tts_available: bool) -> bool:
    """A type that needs audio is offered only when clips can be made (an active, tested TTS endpoint)."""
    return tts_available or exercise_type not in AUDIO_TYPES
