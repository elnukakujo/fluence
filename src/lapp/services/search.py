import logging
import re
from typing import Any, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import db_manager, transactional
from ..models.components import Character, Passage, Word
from ..models.containers import Language, Lesson
from ..models.features import Calligraphy, Exercise, Grammar, Vocabulary
from ..models.system_data import Collaboration, LessonShare, Source, Tag
from .features.studied_types import studied_types

logger = logging.getLogger(__name__)

# CJK Unified Ideographs, Hiragana, Katakana, Hangul syllables — a single
# character in these scripts is a complete, searchable term on its own.
_CJK_PATTERN = re.compile(r"[一-鿿぀-ヿ가-힣]")


def lesson_scope(user_id: str, session: Session):
    """Lessons the user may find: their own, lessons shared with them, and the lessons of a language they collaborate on in full (DM-33)."""
    shared = session.query(LessonShare.lesson_id).filter(LessonShare.user_id == user_id)
    full = (session.query(Lesson.id).join(Collaboration, Collaboration.target_id == Lesson.language_id)
            .filter(Collaboration.target_type == "language", Collaboration.collaborator_id == user_id, Collaboration.status == "accepted",
                    or_(Collaboration.mode.is_(None), Collaboration.mode == "full")))
    return or_(Lesson.user_id == user_id, Lesson.id.in_(shared), Lesson.id.in_(full))


class SearchService:
    @staticmethod
    def _studied(user_id: str, kind: str, results: list[dict[str, Any]], session: Session) -> list[dict[str, Any]]:
        """SG-14: a result of a type that its language does not study is not offered."""
        cache: dict[str, bool] = {}
        for r in results:
            cache.setdefault(r["language_id"], kind in studied_types(user_id, r["language_id"], session=session))
        return [r for r in results if cache[r["language_id"]]]

    def _append_results(self, buckets: dict[str, list[dict[str, Any]]], results: list[dict[str, Any]]) -> None:
        for result in results:
            buckets[result["type"]].append(result)

    def _round_robin(self, buckets: dict[str, list[dict[str, Any]]], limit: int = 20) -> list[dict[str, Any]]:
        ordered_types = [
            "language",
            "lesson",
            "vocabulary",
            "grammar",
            "calligraphy",
            "exercise",
            "character",
            "word",
            "passage",
            "tag",
            "source",
        ]
        merged: list[dict[str, Any]] = []
        while len(merged) < limit:
            added = False
            for result_type in ordered_types:
                if buckets[result_type]:
                    merged.append(buckets[result_type].pop(0))
                    added = True
                    if len(merged) >= limit:
                        break
            if not added:
                break
        return merged

    def _search_languages(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Language.id.label("id"), Language.name.label("label"))
            .filter(Language.user_id == user_id, Language.name.is_not(None), Language.name.ilike(query_pattern))
            .order_by(Language.name)
            .all()
        )
        return [
            {"category": "container", "type": "language", "id": row.id, "label": row.label, "language_id": row.id}
            for row in rows
        ]

    def _search_lessons(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Lesson.id.label("id"), Lesson.title.label("label"), Lesson.language_id.label("language_id"))
            .filter(lesson_scope(user_id, session), Lesson.title.is_not(None), Lesson.title.ilike(query_pattern))
            .order_by(Lesson.title)
            .all()
        )
        return [
            {"category": "container", "type": "lesson", "id": row.id, "label": row.label, "lesson_id": row.id, "language_id": row.language_id}
            for row in rows
        ]

    def _search_vocabulary(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Vocabulary.id.label("id"), Word.word.label("label"), Vocabulary.lesson_id.label("lesson_id"))
            .join(Word, Word.id == Vocabulary.word_id)
            .join(Lesson, Lesson.id == Vocabulary.lesson_id)
            .filter(lesson_scope(user_id, session), Word.word.is_not(None), Word.word.ilike(query_pattern))
            .order_by(Word.word)
            .all()
        )
        found = [
            {"category": "feature", "type": "vocabulary", "id": row.id, "label": row.label, "lesson_id": row.lesson_id, "language_id": self._get_lesson_language_id(row.lesson_id, session)}
            for row in rows
        ]
        return self._studied(user_id, "vocabulary", found, session)

    def _search_grammar(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Grammar.id.label("id"), Grammar.title.label("label"), Grammar.lesson_id.label("lesson_id"))
            .join(Lesson, Lesson.id == Grammar.lesson_id)
            .filter(lesson_scope(user_id, session), Grammar.title.is_not(None), Grammar.title.ilike(query_pattern))
            .order_by(Grammar.title)
            .all()
        )
        found = [
            {"category": "feature", "type": "grammar", "id": row.id, "label": row.label, "lesson_id": row.lesson_id, "language_id": self._get_lesson_language_id(row.lesson_id, session)}
            for row in rows
        ]
        return self._studied(user_id, "grammar", found, session)

    def _search_calligraphy(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Calligraphy.id.label("id"), Character.character.label("label"), Calligraphy.lesson_id.label("lesson_id"))
            .join(Character, Character.id == Calligraphy.character_id)
            .join(Lesson, Lesson.id == Calligraphy.lesson_id)
            .filter(lesson_scope(user_id, session), Character.character.is_not(None), Character.character.ilike(query_pattern))
            .order_by(Character.character)
            .all()
        )
        found = [
            {"category": "feature", "type": "calligraphy", "id": row.id, "label": row.label, "lesson_id": row.lesson_id, "language_id": self._get_lesson_language_id(row.lesson_id, session)}
            for row in rows
        ]
        return self._studied(user_id, "calligraphy", found, session)

    def _search_exercise(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Exercise.id.label("id"), Exercise.question.label("label"), Exercise.lesson_id.label("lesson_id"))
            .join(Lesson, Lesson.id == Exercise.lesson_id)
            .filter(lesson_scope(user_id, session), Exercise.draft.is_(False), Exercise.question.is_not(None), Exercise.question.ilike(query_pattern))
            .order_by(Exercise.question)
            .all()
        )
        found = [
            {"category": "feature", "type": "exercise", "id": row.id, "label": row.label, "lesson_id": row.lesson_id, "language_id": self._get_lesson_language_id(row.lesson_id, session)}
            for row in rows
        ]
        return self._studied(user_id, "exercise", found, session)

    def _search_character(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Character.id.label("id"), Character.character.label("label"), Character.language_id.label("language_id"))
            .join(Language, Language.id == Character.language_id)
            .filter(Language.user_id == user_id, Character.character.is_not(None), Character.character.ilike(query_pattern))
            .order_by(Character.character)
            .all()
        )
        radicals = {r for (r,) in session.query(Character.key_radical_id).filter(Character.key_radical_id.is_not(None)).all()}
        return [
            {"category": "component", "type": "character", "id": row.id, "label": row.label, "language_id": row.language_id, "radical": row.id in radicals}
            for row in rows
        ]

    def _search_tags(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = session.query(Tag.id, Tag.name).filter(Tag.user_id == user_id, Tag.name.ilike(query_pattern)).order_by(Tag.name).all()
        return [{"category": "label", "type": "tag", "id": r.id, "label": r.name} for r in rows]

    def _search_sources(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = session.query(Source.id, Source.title).filter(Source.user_id == user_id, Source.title.ilike(query_pattern)).order_by(Source.title).all()
        return [{"category": "label", "type": "source", "id": r.id, "label": r.title} for r in rows]

    def _search_word(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Word.id.label("id"), Word.word.label("label"), Word.language_id.label("language_id"))
            .join(Language, Language.id == Word.language_id)
            .filter(Language.user_id == user_id, Word.word.is_not(None), Word.word.ilike(query_pattern))
            .order_by(Word.word)
            .all()
        )
        return [
            {"category": "component", "type": "word", "id": row.id, "label": row.label, "language_id": row.language_id}
            for row in rows
        ]

    def _search_passage(self, user_id: str, query_pattern: str, session: Session) -> list[dict[str, Any]]:
        rows = (
            session.query(Passage.id.label("id"), Passage.text.label("label"), Passage.language_id.label("language_id"))
            .join(Language, Language.id == Passage.language_id)
            .filter(Language.user_id == user_id, Passage.text.is_not(None), Passage.text.ilike(query_pattern))
            .order_by(Passage.text)
            .all()
        )
        return [
            {"category": "component", "type": "passage", "id": row.id, "label": row.label, "language_id": row.language_id}
            for row in rows
        ]

    def _get_lesson_language_id(self, lesson_id: str, session: Session) -> Optional[str]:
        lesson = db_manager.find_by_attr(
            model_class=Lesson,
            attr_values={"id": lesson_id},
            session=session,
            load_relationships=False,
        )
        return lesson.language_id if lesson else None

    @transactional
    def search_elements(
        self,
        user_id: str,
        query: str,
        session: Optional[Session] = None,
    ) -> list[dict[str, Any]]:
        normalized_query = (query or "").strip()
        min_length = 1 if _CJK_PATTERN.search(normalized_query) else 2
        if len(normalized_query) < min_length:
            return []

        query_pattern = f"%{normalized_query}%"

        buckets: dict[str, list[dict[str, Any]]] = {
            "language": self._search_languages(user_id, query_pattern, session),
            "lesson": self._search_lessons(user_id, query_pattern, session),
            "vocabulary": self._search_vocabulary(user_id, query_pattern, session),
            "grammar": self._search_grammar(user_id, query_pattern, session),
            "calligraphy": self._search_calligraphy(user_id, query_pattern, session),
            "exercise": self._search_exercise(user_id, query_pattern, session),
            "character": self._search_character(user_id, query_pattern, session),
            "word": self._search_word(user_id, query_pattern, session),
            "passage": self._search_passage(user_id, query_pattern, session),
            "tag": self._search_tags(user_id, query_pattern, session),
            "source": self._search_sources(user_id, query_pattern, session),
        }

        return self._round_robin(buckets, limit=20)
