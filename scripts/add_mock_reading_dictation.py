#!/usr/bin/env python3
"""Add one mock `reading` and one mock `dictation` exercise (Japanese) to an existing lesson, to try the two runners.

Usage:
    python scripts/add_mock_reading_dictation.py                      # list lessons (read-only)
    python scripts/add_mock_reading_dictation.py LESSON_ID            # add the two exercises
    python scripts/add_mock_reading_dictation.py LESSON_ID --env dev
Bypasses the service layer like seed_demo.py; IDs come from db_manager.generate_new_id().
"""
import argparse

from flask import Flask

from config import config as CONFIGS
from lapp.core.database import db_manager
from lapp.models import Exercise, Lesson
from lapp.schemas.features.exercise import ExerciseDict

READING = {
    "exercise_type": "reading",
    "question": "Read the dialogue aloud, then grade yourself.",
    "content": {
        "speakers": [{"id": "s1", "name": "田中"}, {"id": "s2", "name": "スミス"}],
        "lines": [
            {"speakerId": "s1", "text": "はじめまして。田中です。", "translation": "Nice to meet you. I am Tanaka.", "audioIndex": None},
            {"speakerId": "s2", "text": "スミスです。どうぞよろしく。", "translation": "I am Smith. Pleased to meet you.", "audioIndex": None},
            {"speakerId": "s1", "text": "日本語がお上手ですね。", "translation": "Your Japanese is good.", "audioIndex": None},
            {"speakerId": "s2", "text": "いいえ、まだまだです。", "translation": "No, not yet.", "audioIndex": None},
        ],
    },
}
DICTATION = {
    "exercise_type": "dictation",
    "question": "Listen and write what you hear.",
    "content": {"lines": [
        {"text": "犬がいます。", "audioIndex": None},
        {"text": "私は毎日水を飲みます。", "audioIndex": None},
        {"text": "明日、友達と映画を見ます。", "audioIndex": None},
    ]},
}


def mock_exercises(lesson_id: str) -> list[dict]:
    """The two exercises as the app stores them (answer = joined lines), validated by the real schema."""
    out = []
    for ex in (READING, DICTATION):
        texts = [l["text"] for l in ex["content"]["lines"]]
        data = {**ex, "answer": "\n".join(texts) if ex["exercise_type"] == "reading" else " ".join(texts), "lesson_id": lesson_id}
        ExerciseDict(**data)
        out.append(data)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("lesson_id", nargs="?")
    parser.add_argument("--env", default="prod", choices=["dev", "test", "prod"])
    args = parser.parse_args()

    app = Flask(__name__)
    app.config.from_object(CONFIGS[args.env])
    db_manager.init_app(app)
    with app.app_context(), db_manager.session_scope() as session:
        if not args.lesson_id:
            for l in session.query(Lesson).order_by(Lesson.language_id, Lesson.id):
                print(l.id, l.language_id, l.title)
            return 0
        if session.get(Lesson, args.lesson_id) is None:
            print(f"No lesson {args.lesson_id}")
            return 1
        for data in mock_exercises(args.lesson_id):
            session.add(Exercise(id=db_manager.generate_new_id(Exercise, session=session), **data))
        print(f"Added a reading and a dictation exercise to {args.lesson_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
