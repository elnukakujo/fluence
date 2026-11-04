import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from add_mock_reading_dictation import mock_exercises  # noqa: E402


def test_mock_exercises_pass_the_real_schema():
    reading, dictation = mock_exercises("lesson_1")
    assert reading["answer"].count("\n") == 3 and dictation["answer"].count(" ") == 2
    assert {reading["exercise_type"], dictation["exercise_type"]} == {"reading", "dictation"}
