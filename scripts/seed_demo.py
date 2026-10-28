#!/usr/bin/env python3
"""Seed the database with a small demo dataset: a user, a language, lessons,
words, vocabulary, grammar, calligraphy, exercises, tags and a source.

Bypasses the service layer on purpose: the service create() methods run
NMT/spaCy enrichment on every word/passage (slow, and needs downloaded models),
which a mockup seed shouldn't depend on. IDs still come from
db_manager.generate_new_id() so future app-created rows never collide.

Usage:
    uv run python scripts/seed_demo.py             # seed the prod schema
    uv run python scripts/seed_demo.py --env dev   # seed the dev schema
    uv run python scripts/seed_demo.py --reset     # drop tables first, then seed
    uv run python scripts/seed_demo.py --email you@example.com --username you  # seed a specific (existing or new) user
"""

import argparse
import json
from datetime import date

from flask import Flask
from werkzeug.security import generate_password_hash

from config import config as CONFIGS
from lapp.core.database import db_manager
from lapp.models import (
    User,
    UserPreferences,
    Language,
    Lesson,
    Word,
    Passage,
    Character,
    Vocabulary,
    Grammar,
    Calligraphy,
    Exercise,
    Tag,
    Source,
)

DEMO_EMAIL = "demo@example.com"
DEMO_USERNAME = "demo"
DEMO_DISPLAY_NAME = "Demo User"
DEMO_PASSWORD = "demo"


def gen(model, session):
    return db_manager.generate_new_id(model, session=session)


def gen_many(model, session, n):
    return [gen(model, session) for _ in range(n)]


def seed_course(session, user_id: str) -> None:
    # --- Generate every ID first, on an otherwise-empty session, so the
    # flushes inside generate_new_id never see a half-built object graph ---
    lang_id = gen(Language, session)
    lesson_ids = gen_many(Lesson, session, 3)
    word_ids = gen_many(Word, session, 8)
    passage_ids = gen_many(Passage, session, 3)
    char_ids = gen_many(Character, session, 3)
    tag_ids = gen_many(Tag, session, 2)
    src_id = gen(Source, session)
    vocab_ids = gen_many(Vocabulary, session, 8)
    grammar_ids = gen_many(Grammar, session, 2)
    call_ids = gen_many(Calligraphy, session, 3)
    ex_ids = gen_many(Exercise, session, 6)

    language = Language(
        id=lang_id,
        user_id=user_id,
        name="Japanese",
        alias="日本語",
        flag="🇯🇵",
        level=0,
        description="Beginner Japanese demo course",
        source_iso639_2t="eng",
        target_iso639_2t="jpn",
    )
    session.add(language)
    # language<->lesson is a circular FK (lesson.language_id -> language.id,
    # language.current_lesson_id -> lesson.id). Flush here so language is in the
    # DB before lessons/words/passages/characters reference it — SQLAlchemy's
    # bulk sort can't order around that cycle on its own.
    session.flush()

    lessons = {
        "animals": Lesson(id=lesson_ids[0], language_id=lang_id, user_id=user_id, title="Animals", level=0, description="Basic animal vocabulary"),
        "nature": Lesson(id=lesson_ids[1], language_id=lang_id, user_id=user_id, title="Nature", level=0, description="Nature and the elements"),
        "actions": Lesson(id=lesson_ids[2], language_id=lang_id, user_id=user_id, title="Everyday Actions", level=1, description="Common verbs and the を particle"),
    }
    session.add_all(lessons.values())
    # current_lesson_id is left NULL: it's a circular FK (language<->lesson) the
    # app recomputes lazily via LanguageService._check_current_lesson on read.

    # --- Words (components, belong to the language) ---
    word_specs = [
        ("猫", "cat", "neko", "noun"),
        ("犬", "dog", "inu", "noun"),
        ("水", "water", "mizu", "noun"),
        ("火", "fire", "hi", "noun"),
        ("山", "mountain", "yama", "noun"),
        ("人", "person", "hito", "noun"),
        ("食べる", "to eat", "taberu", "verb"),
        ("飲む", "to drink", "nomu", "verb"),
    ]
    words = {
        text: Word(id=wid, language_id=lang_id, word=text, translation=trans, phonetic=ph, word_type=wt)
        for wid, (text, trans, ph, wt) in zip(word_ids, word_specs)
    }
    session.add_all(words.values())

    # --- Passages (components, example sentences) ---
    passage_specs = [
        ("drink", "水を飲みます。", "I drink water."),
        ("like_cats", "猫が好きです。", "I like cats."),
        ("climb", "山に登ります。", "I climb the mountain."),
    ]
    passages = {
        key: Passage(id=pid, language_id=lang_id, text=text, translation=trans)
        for pid, (key, text, trans) in zip(passage_ids, passage_specs)
    }
    session.add_all(passages.values())

    # --- Characters (components, used by calligraphy) ---
    char_specs = [
        ("水", "みず", "water", "水", 4),
        ("火", "ひ", "fire", "火", 4),
        ("山", "やま", "mountain", "山", 3),
    ]
    characters = {
        ch: Character(id=cid, language_id=lang_id, character=ch, phonetic=ph, meaning=meaning, radical=rad, strokes=strokes)
        for cid, (ch, ph, meaning, rad, strokes) in zip(char_ids, char_specs)
    }
    session.add_all(characters.values())

    # --- Tags and sources (system data) ---
    tag_n5 = Tag(id=tag_ids[0], user_id=user_id, name="N5", color="#4ade80", description="JLPT N5 level")
    tag_essential = Tag(id=tag_ids[1], user_id=user_id, name="essential", color="#facc15", description="Must-know basics")
    source_genki = Source(
        id=src_id,
        user_id=user_id,
        title="Genki Textbook",
        date=date(2020, 1, 1),
        description="Genki: An Integrated Course in Elementary Japanese",
        source_type="textbook",
    )
    session.add_all([tag_n5, tag_essential, source_genki])
    # Features below reference lessons/words/passages/characters — get those
    # into the DB first so their FKs resolve at insert time.
    session.flush()

    # --- Vocabulary (features, belong to a lesson, reference a word) ---
    vocab_specs = [
        ("猫", "animals", 50, ["like_cats"], ["essential"], ["genki"]),
        ("犬", "animals", 0, [], [], []),
        ("水", "nature", 80, ["drink"], ["essential"], []),
        ("火", "nature", 0, [], [], []),
        ("山", "nature", 100, ["climb"], [], []),
        ("食べる", "actions", 0, [], ["essential"], []),
        ("飲む", "actions", 40, ["drink"], [], []),
        ("人", "actions", 0, [], [], []),
    ]
    vocab = {}
    for vid, (word_key, lesson_key, score, ex_keys, tag_keys, src_keys) in zip(vocab_ids, vocab_specs):
        v = Vocabulary(
            id=vid,
            lesson_id=lessons[lesson_key].id,
            word_id=words[word_key].id,
            score=score,
            example_sentences=[passages[k] for k in ex_keys],
            tags=[{"essential": tag_essential, "n5": tag_n5}[k] for k in tag_keys],
            sources=[source_genki] if src_keys else [],
        )
        session.add(v)
        vocab[word_key] = v

    # --- Grammar (features) ---
    grammar = {
        "masu": Grammar(
            id=grammar_ids[0],
            lesson_id=lessons["actions"].id,
            title="Verb ます-form",
            explanation="The polite present tense ends in ます. Replace the dictionary-form る with ます for ichidan verbs.",
            example_words=[words["食べる"], words["飲む"]],
            example_sentences=[passages["drink"]],
            tags=[tag_n5],
        ),
        "wo": Grammar(
            id=grammar_ids[1],
            lesson_id=lessons["actions"].id,
            title="Particle を (object marker)",
            explanation="を marks the direct object of a transitive verb.",
            example_sentences=[passages["drink"], passages["climb"]],
            tags=[tag_essential],
        ),
    }
    session.add_all(grammar.values())

    # --- Calligraphy (features, reference a character) ---
    calligraphy = {
        "水": Calligraphy(
            id=call_ids[0],
            lesson_id=lessons["nature"].id,
            character_id=characters["水"].id,
            example_words=[words["水"]],
            example_sentences=[passages["drink"]],
            score=20,
        ),
        "火": Calligraphy(
            id=call_ids[1],
            lesson_id=lessons["nature"].id,
            character_id=characters["火"].id,
            example_words=[words["火"]],
            score=0,
        ),
        "山": Calligraphy(
            id=call_ids[2],
            lesson_id=lessons["nature"].id,
            character_id=characters["山"].id,
            example_words=[words["山"]],
            example_sentences=[passages["climb"]],
            score=0,
        ),
    }
    session.add_all(calligraphy.values())

    # --- Exercises (features) ---
    exercises = [
        Exercise(
            id=ex_ids[0],
            lesson_id=lessons["animals"].id,
            exercise_type="translate",
            question="What does 猫 mean in English?",
            answer="cat",
            related_vocabulary=[vocab["猫"]],
        ),
        Exercise(
            id=ex_ids[1],
            lesson_id=lessons["animals"].id,
            exercise_type="quizz",
            question="Which of these means 'dog'?",
            answer="犬",
            content={"options": ["猫", "犬", "水"], "correct": [1]},
            related_vocabulary=[vocab["犬"]],
        ),
        Exercise(
            id=ex_ids[2],
            lesson_id=lessons["nature"].id,
            exercise_type="type_in_the_blank",
            question="Fill in the blank:",
            answer="水",
            text_support="I drink __ every day.",
            content={"segments": ["私は", "を飲みます。"], "blanks": [{"answer": "水"}]},
            related_vocabulary=[vocab["水"]],
        ),
        Exercise(
            id=ex_ids[3],
            lesson_id=lessons["actions"].id,
            exercise_type="matching",
            question="Match the verbs to their meanings.",
            answer="食べる=to eat, 飲む=to drink",
            content={"pairs": [["食べる", "to eat"], ["飲む", "to drink"]]},
            related_vocabulary=[vocab["食べる"], vocab["飲む"]],
        ),
        Exercise(
            id=ex_ids[4],
            lesson_id=lessons["actions"].id,
            exercise_type="true_false",
            question="True or false?",
            answer="true",
            content={"statement": "「を」 marks the object of a verb.", "answer": True},
            related_grammar=[grammar["wo"]],
        ),
        Exercise(
            id=ex_ids[5],
            lesson_id=lessons["actions"].id,
            exercise_type="conversation",
            question=json.dumps({
                "speakers": [
                    {"id": "s1", "name": "店員", "isUser": False},
                    {"id": "s2", "name": "あなた", "isUser": True},
                ],
                "lines": [
                    {"speakerId": "s1", "text": "いらっしゃいませ！", "audioIndex": 0},
                    {"speakerId": "s2", "text": "こんにちは。水をください。", "audioIndex": 1},
                    {"speakerId": "s1", "text": "かしこまりました。", "audioIndex": 2},
                    {"speakerId": "s2", "text": "ありがとうございます。", "audioIndex": 3},
                ],
            }),
            answer="Scripted restaurant dialogue",
            audio_files=[],  # reference audio is a TTS follow-up (ElevenLabs)
            related_vocabulary=[vocab["水"]],
        ),
    ]
    session.add_all(exercises)

    print(
        f"Seeded course for {user_id}: 1 language, {len(lessons)} lessons, {len(words)} words, "
        f"{len(passages)} passages, {len(characters)} characters, {len(vocab)} vocabulary, "
        f"{len(grammar)} grammar, {len(calligraphy)} calligraphy, {len(exercises)} exercises, "
        f"2 tags, 1 source"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed demo data into the database.")
    parser.add_argument("--env", default="prod", choices=["dev", "test", "prod"])
    parser.add_argument("--email", default=DEMO_EMAIL)
    parser.add_argument("--username", default=DEMO_USERNAME)
    parser.add_argument("--display-name", default=DEMO_DISPLAY_NAME)
    parser.add_argument("--password", default=DEMO_PASSWORD)
    parser.add_argument("--reset", action="store_true", help="drop and recreate tables before seeding")
    args = parser.parse_args()

    app = Flask(__name__)
    app.config.from_object(CONFIGS[args.env])
    db_manager.init_app(app)       # engine + schema
    db_manager.run_migrations()    # ensure tables exist (idempotent)

    if args.reset:
        db_manager.drop_tables()
        db_manager.create_tables()

    with app.app_context():
        with db_manager.session_scope() as session:
            user = session.query(User).filter(User.email == args.email).first()
            if user and session.query(Language).filter(Language.user_id == user.id).first():
                print(f"{args.email} already has course data. Use --reset to wipe and reseed.")
                return 0
            if user is None:
                user = User(
                    id=gen(User, session),
                    username=args.username,
                    display_name=args.display_name,
                    email=args.email,
                    password_hash=generate_password_hash(args.password),
                    is_admin=session.query(User).count() == 0,  # first account = admin
                )
                session.add(user)
                session.flush()
            if not session.query(UserPreferences).filter(UserPreferences.user_id == user.id).first():
                session.add(
                    UserPreferences(
                        id=gen(UserPreferences, session),
                        user_id=user.id,
                        native_language_iso639_2=["eng"],
                        learning_goals="Learn Japanese basics",
                        daily_goal_minutes=20,
                    )
                )
            seed_course(session, user.id)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
