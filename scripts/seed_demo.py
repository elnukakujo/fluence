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
    uv run python scripts/seed_demo.py --language chinese    # seed only Chinese
    uv run python scripts/seed_demo.py --language japanese   # seed only Japanese
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


# ---------------------------------------------------------------------------
# Course data. Each course spec is keyed by its pieces; `seed_course` builds
# the ORM objects and wires the references together. Add a new language here.
# ---------------------------------------------------------------------------
COURSES = {
    "japanese": {
        "language": {
            "name": "Japanese",
            "alias": "日本語",
            "flag": "🇯🇵",
            "level": 0,
            "description": "Beginner Japanese demo course",
            "target_iso639_2t": "jpn",
        },
        "lessons": {
            "animals": {"title": "Animals", "level": 0, "description": "Basic animal vocabulary"},
            "nature": {"title": "Nature", "level": 0, "description": "Nature and the elements"},
            "actions": {"title": "Everyday Actions", "level": 1, "description": "Common verbs and the を particle"},
        },
        "words": {
            "猫": {"translation": "cat", "phonetic": "neko", "word_type": "noun"},
            "犬": {"translation": "dog", "phonetic": "inu", "word_type": "noun"},
            "水": {"translation": "water", "phonetic": "mizu", "word_type": "noun"},
            "火": {"translation": "fire", "phonetic": "hi", "word_type": "noun"},
            "山": {"translation": "mountain", "phonetic": "yama", "word_type": "noun"},
            "人": {"translation": "person", "phonetic": "hito", "word_type": "noun"},
            "食べる": {"translation": "to eat", "phonetic": "taberu", "word_type": "verb"},
            "飲む": {"translation": "to drink", "phonetic": "nomu", "word_type": "verb"},
        },
        "passages": {
            "drink": {"text": "水を飲みます。", "translation": "I drink water."},
            "like_cats": {"text": "猫が好きです。", "translation": "I like cats."},
            "climb": {"text": "山に登ります。", "translation": "I climb the mountain."},
        },
        "characters": {
            "水": {"phonetic": "みず", "meaning": "water", "radical": "水", "strokes": 4},
            "火": {"phonetic": "ひ", "meaning": "fire", "radical": "火", "strokes": 4},
            "山": {"phonetic": "やま", "meaning": "mountain", "radical": "山", "strokes": 3},
        },
        "tags": {
            "n5": {"name": "N5", "color": "#4ade80", "description": "JLPT N5 level"},
            "essential": {"name": "essential", "color": "#facc15", "description": "Must-know basics"},
        },
        "source": {
            "title": "Genki Textbook",
            "date": date(2020, 1, 1),
            "description": "Genki: An Integrated Course in Elementary Japanese",
            "source_type": "textbook",
        },
        "vocab": [
            ("猫", "animals", ["like_cats"], ["essential"], True),
            ("犬", "animals", [], [], False),
            ("水", "nature", ["drink"], ["essential"], False),
            ("火", "nature", [], [], False),
            ("山", "nature", ["climb"], [], False),
            ("食べる", "actions", [], ["essential"], False),
            ("飲む", "actions", ["drink"], [], False),
            ("人", "actions", [], [], False),
        ],
        "grammar": {
            "masu": {
                "lesson": "actions",
                "title": "Verb ます-form",
                "explanation": "The polite present tense ends in ます. Replace the dictionary-form る with ます for ichidan verbs.",
                "example_words": ["食べる", "飲む"],
                "example_sentences": ["drink"],
                "tags": ["n5"],
            },
            "wo": {
                "lesson": "actions",
                "title": "Particle を (object marker)",
                "explanation": "を marks the direct object of a transitive verb.",
                "example_sentences": ["drink", "climb"],
                "tags": ["essential"],
            },
        },
        "calligraphy": {
            "水": {"lesson": "nature", "example_words": ["水"], "example_sentences": ["drink"]},
            "火": {"lesson": "nature", "example_words": ["火"], "example_sentences": []},
            "山": {"lesson": "nature", "example_words": ["山"], "example_sentences": ["climb"]},
        },
        "exercises": [
            {"lesson": "animals", "exercise_type": "translate", "question": "What does 猫 mean in English?", "answer": "cat", "related_vocabulary": ["猫"]},
            {"lesson": "animals", "exercise_type": "quizz", "question": "Which of these means 'dog'?", "answer": "犬", "content": {"options": ["猫", "犬", "水"], "correct": [1]}, "related_vocabulary": ["犬"]},
            {"lesson": "nature", "exercise_type": "type_in_the_blank", "question": "Fill in the blank:", "answer": "水", "text_support": "I drink __ every day.", "content": {"segments": ["私は", "を飲みます。"], "blanks": [{"answer": "水"}]}, "related_vocabulary": ["水"]},
            {"lesson": "actions", "exercise_type": "matching", "question": "Match the verbs to their meanings.", "answer": "食べる=to eat, 飲む=to drink", "content": {"pairs": [["食べる", "to eat"], ["飲む", "to drink"]]}, "related_vocabulary": ["食べる", "飲む"]},
            {"lesson": "actions", "exercise_type": "true_false", "question": "True or false?", "answer": "true", "content": {"statement": "「を」 marks the object of a verb.", "answer": True}, "related_grammar": ["wo"]},
            {"lesson": "actions", "exercise_type": "conversation", "question": json.dumps({
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
            }), "answer": "Scripted restaurant dialogue", "audio_files": [], "related_vocabulary": ["水"]},
        ],
    },
    "chinese": {
        "language": {
            "name": "Chinese",
            "alias": "中文",
            "flag": "🇨🇳",
            "level": 0,
            "description": "Beginner Mandarin demo course",
            "target_iso639_2t": "zho",  # ISO 639-2/T (not "chi", the /B code)
        },
        "lessons": {
            "greetings": {"title": "Greetings", "level": 0, "description": "Basic greetings and introductions"},
            "food": {"title": "Food & Drink", "level": 0, "description": "Food and drink vocabulary"},
            "family": {"title": "Family", "level": 1, "description": "Family members and the 的 particle"},
        },
        "words": {
            "你": {"translation": "you", "phonetic": "nǐ", "word_type": "pronoun"},
            "好": {"translation": "good", "phonetic": "hǎo", "word_type": "adjective"},
            "我": {"translation": "I / me", "phonetic": "wǒ", "word_type": "pronoun"},
            "吃": {"translation": "to eat", "phonetic": "chī", "word_type": "verb"},
            "饭": {"translation": "rice / meal", "phonetic": "fàn", "word_type": "noun"},
            "水": {"translation": "water", "phonetic": "shuǐ", "word_type": "noun"},
            "茶": {"translation": "tea", "phonetic": "chá", "word_type": "noun"},
            "家": {"translation": "family / home", "phonetic": "jiā", "word_type": "noun"},
        },
        "passages": {
            "hello": {"text": "你好。", "translation": "Hello."},
            "eat": {"text": "我吃饭。", "translation": "I eat."},
            "drink": {"text": "我喝水。", "translation": "I drink water."},
        },
        "characters": {
            "水": {"phonetic": "shuǐ", "meaning": "water", "radical": "水", "strokes": 4},
            "茶": {"phonetic": "chá", "meaning": "tea", "radical": "艹", "strokes": 9},
            "家": {"phonetic": "jiā", "meaning": "family", "radical": "宀", "strokes": 10},
        },
        "tags": {
            "hsk1": {"name": "HSK1", "color": "#f43f5e", "description": "HSK Level 1"},
            "essential": {"name": "essential", "color": "#facc15", "description": "Must-know basics"},
        },
        "source": {
            "title": "HSK Standard Course 1",
            "date": date(2021, 1, 1),
            "description": "HSK Standard Course Level 1",
            "source_type": "textbook",
        },
        "vocab": [
            ("你", "greetings", ["hello"], ["essential"], False),
            ("好", "greetings", [], [], False),
            ("我", "greetings", ["hello"], ["essential"], False),
            ("吃", "food", [], ["essential"], False),
            ("饭", "food", ["eat"], [], False),
            ("水", "food", ["drink"], ["essential"], False),
            ("茶", "food", [], [], False),
            ("家", "family", [], ["essential"], True),
        ],
        "grammar": {
            "ni_hao": {
                "lesson": "greetings",
                "title": "你好 greeting",
                "explanation": "你好 (nǐ hǎo) means 'hello'. It combines 你 (you) and 好 (good).",
                "example_words": ["你", "好"],
                "example_sentences": ["hello"],
                "tags": ["hsk1"],
            },
            "svo": {
                "lesson": "food",
                "title": "Subject-Verb-Object order",
                "explanation": "Mandarin follows Subject-Verb-Object order: 我 (I) + 吃 (eat) + 饭 (rice).",
                "example_words": ["吃", "饭"],
                "example_sentences": ["eat"],
                "tags": ["essential"],
            },
        },
        "calligraphy": {
            "水": {"lesson": "food", "example_words": ["水"], "example_sentences": ["drink"]},
            "茶": {"lesson": "food", "example_words": ["茶"], "example_sentences": []},
            "家": {"lesson": "family", "example_words": ["家"], "example_sentences": []},
        },
        "exercises": [
            {"lesson": "greetings", "exercise_type": "translate", "question": "What does 你好 mean in English?", "answer": "hello", "related_vocabulary": ["你", "好"]},
            {"lesson": "greetings", "exercise_type": "quizz", "question": "Which of these means 'I'?", "answer": "我", "content": {"options": ["你", "我", "好"], "correct": [1]}, "related_vocabulary": ["我"]},
            {"lesson": "food", "exercise_type": "type_in_the_blank", "question": "Fill in the blank:", "answer": "水", "text_support": "I drink __ every day.", "content": {"segments": ["我喝", "。"], "blanks": [{"answer": "水"}]}, "related_vocabulary": ["水"]},
            {"lesson": "food", "exercise_type": "matching", "question": "Match the words to their meanings.", "answer": "吃=to eat, 饭=rice/meal", "content": {"pairs": [["吃", "to eat"], ["饭", "rice/meal"]]}, "related_vocabulary": ["吃", "饭"]},
            {"lesson": "food", "exercise_type": "true_false", "question": "True or false?", "answer": "true", "content": {"statement": "「我吃饭」 follows Subject-Verb-Object order.", "answer": True}, "related_grammar": ["svo"]},
            {"lesson": "greetings", "exercise_type": "conversation", "question": json.dumps({
                "speakers": [
                    {"id": "s1", "name": "服务员", "isUser": False},
                    {"id": "s2", "name": "你", "isUser": True},
                ],
                "lines": [
                    {"speakerId": "s1", "text": "你好！欢迎光临！", "audioIndex": 0},
                    {"speakerId": "s2", "text": "你好！", "audioIndex": 1},
                    {"speakerId": "s1", "text": "请坐。", "audioIndex": 2},
                    {"speakerId": "s2", "text": "谢谢！", "audioIndex": 3},
                ],
            }), "answer": "Scripted restaurant dialogue", "audio_files": [], "related_vocabulary": ["你", "好"]},
        ],
    },
}


def seed_course(session, user_id: str, spec: dict) -> None:
    # --- Generate every ID first, on an otherwise-empty session, so the
    # flushes inside generate_new_id never see a half-built object graph ---
    lang_id = gen(Language, session)
    lesson_ids = gen_many(Lesson, session, len(spec["lessons"]))
    word_ids = gen_many(Word, session, len(spec["words"]))
    passage_ids = gen_many(Passage, session, len(spec["passages"]))
    char_ids = gen_many(Character, session, len(spec["characters"]))
    tag_ids = gen_many(Tag, session, len(spec["tags"]))
    src_id = gen(Source, session)
    vocab_ids = gen_many(Vocabulary, session, len(spec["vocab"]))
    grammar_ids = gen_many(Grammar, session, len(spec["grammar"]))
    call_ids = gen_many(Calligraphy, session, len(spec["calligraphy"]))
    ex_ids = gen_many(Exercise, session, len(spec["exercises"]))

    language = Language(
        id=lang_id,
        user_id=user_id,
        source_iso639_2t="eng",
        **spec["language"],
    )
    session.add(language)
    # language<->lesson is a circular FK (lesson.language_id -> language.id,
    # language.current_lesson_id -> lesson.id). Flush here so language is in the
    # DB before lessons/words/passages/characters reference it — SQLAlchemy's
    # bulk sort can't order around that cycle on its own.
    session.flush()

    lessons = {
        key: Lesson(id=lid, language_id=lang_id, user_id=user_id, **l)
        for lid, (key, l) in zip(lesson_ids, spec["lessons"].items())
    }
    session.add_all(lessons.values())
    # current_lesson_id is left NULL: it's a circular FK (language<->lesson) the
    # app recomputes lazily via LanguageService._check_current_lesson on read.

    # --- Words (components, belong to the language) ---
    words = {
        text: Word(id=wid, language_id=lang_id, word=text, **w)
        for wid, (text, w) in zip(word_ids, spec["words"].items())
    }
    session.add_all(words.values())

    # --- Passages (components, example sentences) ---
    passages = {
        key: Passage(id=pid, language_id=lang_id, **p)
        for pid, (key, p) in zip(passage_ids, spec["passages"].items())
    }
    session.add_all(passages.values())

    # --- Characters (components, used by calligraphy) ---
    characters = {
        ch: Character(id=cid, language_id=lang_id, character=ch, **c)
        for cid, (ch, c) in zip(char_ids, spec["characters"].items())
    }
    session.add_all(characters.values())

    # --- Tags and sources (system data) ---
    # Tags are unique per (user_id, name); a tag like "essential" is shared
    # across a user's courses, so reuse it instead of inserting a duplicate.
    tags = {}
    for tid, (key, t) in zip(tag_ids, spec["tags"].items()):
        existing = session.query(Tag).filter(
            Tag.user_id == user_id, Tag.name == t["name"]
        ).first()
        if existing:
            tags[key] = existing
        else:
            tags[key] = Tag(id=tid, user_id=user_id, **t)
            session.add(tags[key])
    source = Source(id=src_id, user_id=user_id, **spec["source"])
    session.add_all([*tags.values(), source])
    # Features below reference lessons/words/passages/characters — get those
    # into the DB first so their FKs resolve at insert time.
    session.flush()

    # --- Vocabulary (features, belong to a lesson, reference a word) ---
    # Scores now live in the Score table (per user+element), not on Vocabulary,
    # so a fresh seed leaves everything "unreviewed" — the review queue defaults
    # score to 0.
    vocab = {}
    for vid, (word_key, lesson_key, ex_keys, tag_keys, use_source) in zip(vocab_ids, spec["vocab"]):
        v = Vocabulary(
            id=vid,
            lesson_id=lessons[lesson_key].id,
            word_id=words[word_key].id,
            example_sentences=[passages[k] for k in ex_keys],
            tags=[tags[k] for k in tag_keys],
            sources=[source] if use_source else [],
        )
        session.add(v)
        vocab[word_key] = v

    # --- Grammar (features) ---
    grammar = {}
    for gid, (key, g) in zip(grammar_ids, spec["grammar"].items()):
        grammar[key] = Grammar(
            id=gid,
            lesson_id=lessons[g["lesson"]].id,
            title=g["title"],
            explanation=g["explanation"],
            example_words=[words[w] for w in g.get("example_words", [])],
            example_sentences=[passages[p] for p in g.get("example_sentences", [])],
            tags=[tags[t] for t in g.get("tags", [])],
        )
        session.add(grammar[key])

    # --- Calligraphy (features, reference a character) ---
    calligraphy = {}
    for cid, (char, c) in zip(call_ids, spec["calligraphy"].items()):
        calligraphy[char] = Calligraphy(
            id=cid,
            lesson_id=lessons[c["lesson"]].id,
            character_id=characters[char].id,
            example_words=[words[w] for w in c.get("example_words", [])],
            example_sentences=[passages[p] for p in c.get("example_sentences", [])],
        )
        session.add(calligraphy[char])

    # --- Exercises (features) ---
    for eid, e in zip(ex_ids, spec["exercises"]):
        kwargs = {
            "id": eid,
            "lesson_id": lessons[e["lesson"]].id,
            "exercise_type": e["exercise_type"],
            "question": e["question"],
            "answer": e["answer"],
            "related_vocabulary": [vocab[w] for w in e.get("related_vocabulary", [])],
            "related_grammar": [grammar[g] for g in e.get("related_grammar", [])],
        }
        if "content" in e:
            kwargs["content"] = e["content"]
        if "text_support" in e:
            kwargs["text_support"] = e["text_support"]
        if "audio_files" in e:
            kwargs["audio_files"] = e["audio_files"]
        session.add(Exercise(**kwargs))

    print(
        f"Seeded {spec['language']['name']} course for {user_id}: 1 language, {len(lessons)} lessons, "
        f"{len(words)} words, {len(passages)} passages, {len(characters)} characters, {len(vocab)} vocabulary, "
        f"{len(grammar)} grammar, {len(calligraphy)} calligraphy, {len(ex_ids)} exercises, "
        f"{len(tags)} tags, 1 source"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed demo data into the database.")
    parser.add_argument("--env", default="prod", choices=["dev", "test", "prod"])
    parser.add_argument("--language", default="both", choices=["japanese", "chinese", "both"])
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

    selected = list(COURSES) if args.language == "both" else [args.language]

    with app.app_context():
        with db_manager.session_scope() as session:
            user = session.query(User).filter(User.email == args.email).first()
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
                        learning_goals="Learn language basics",
                        daily_goal_minutes=20,
                    )
                )

            for lang_key in selected:
                lang_name = COURSES[lang_key]["language"]["name"]
                existing = session.query(Language).filter(
                    Language.user_id == user.id, Language.name == lang_name
                ).first()
                if existing:
                    iso = COURSES[lang_key]["language"]["target_iso639_2t"]
                    if existing.target_iso639_2t != iso:  # repair rows seeded with a wrong code
                        print(f"Fixing {lang_name} target ISO {existing.target_iso639_2t!r} -> {iso!r}")
                        existing.target_iso639_2t = iso
                    print(f"{args.email} already has a {lang_name} course. Use --reset to wipe and reseed.")
                    continue
                seed_course(session, user.id, COURSES[lang_key])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
