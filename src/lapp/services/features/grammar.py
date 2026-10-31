from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.features import GrammarDict
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict
from ...models.features import Grammar
from ...models.system_data import Tag, Source, Score
from ..containers import LessonService, LanguageService
from ..components import PassageService, WordService
from ..data_collection import ProgressTrackingService
from ..system_data import ScoreService
from ...core.database import db_manager, transactional, resolve_related
from ...utils import update_score, update_difficulty, status_for

lesson_service = LessonService()
language_service = LanguageService()
word_service = WordService()
passage_service = PassageService()
progress_tracking_service = ProgressTrackingService()
score_service = ScoreService()

class GrammarService:
    def _serialize(self, grammar: Grammar | None, as_dict: bool, include_relations: bool) -> Grammar | dict | None:
        if not as_dict or grammar is None:
            return grammar
        return grammar.to_dict(include_relations=include_relations)

    def _serialize_list(self, grammars: list[Grammar], as_dict: bool, include_relations: bool) -> list[Grammar] | list[dict]:
        if not as_dict:
            return grammars
        return [grammar.to_dict(include_relations=include_relations) for grammar in grammars]

    @transactional
    def get_all(
        self,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Grammar] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            grammars = []
            for lesson in lessons:
                grammars.extend(
                    db_manager.find_all(
                        model_class=Grammar,
                        filters={'lesson_id': lesson.id},
                        session=session
                    )
                )
            return self._serialize_list(grammars, as_dict, include_relations)
        elif lesson_id:
            grammars = db_manager.find_all(
                model_class=Grammar,
                filters={'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(grammars, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def get_by_id(
        self,
        grammar_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Grammar | dict | None:
        grammar = db_manager.find_by_attr(
            model_class=Grammar,
            attr_values={'id': grammar_id},
            session=session
        )
        return self._serialize(grammar, as_dict, include_relations)

    @transactional
    def get_by_level(
        self,
        level: int,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Grammar] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            grammars = []
            for lesson in lessons:
                grammars.extend(
                    db_manager.find_all(
                        model_class=Grammar,
                        filters={'level': level, 'lesson_id': lesson.id},
                        session=session
                    )
                )
            return self._serialize_list(grammars, as_dict, include_relations)
        elif lesson_id:
            grammars = db_manager.find_all(
                model_class=Grammar,
                filters={'level': level, 'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(grammars, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def create(
        self,
        data: GrammarDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Grammar | dict | None:
        lesson = lesson_service.get_by_id(data.lesson_id, session=session)
        if not lesson:
            logger.warning(f"Cannot create Grammar item, lesson not found: {data.lesson_id}")
            return None

        example_sentences = []
        for sentence in (data.example_sentences or []):
            sentence.language_id = lesson.language_id
            passage = passage_service.create(sentence, session=session)
            if passage:
                example_sentences.append(passage)

        grammar = Grammar(
            id=db_manager.generate_new_id(model_class=Grammar, session=session),
            lesson_id=lesson.id,
            title=data.title,
            explanation=data.explanation,
            example_sentences=example_sentences,
            image_files=data.image_files or [],
            audio_files=data.audio_files or [],
            tags=session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources=session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else []
        )

        result = db_manager.insert(obj=grammar, session=session, commit=False)

        if result:
            logger.info(f"Created new Grammar item with ID: {result.id}")
        else:
            logger.error(f"Failed to create new Grammar item: {grammar.title}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        grammar_id: str,
        data: GrammarDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Grammar | dict | None:
        existing = self.get_by_id(grammar_id, session=session)
        if not existing:
            logger.warning(f"Grammar item not found: {grammar_id}")
            return None

        existing.example_words = []
        if data.example_words is not None:
            for example_word_data in data.example_words:
                example_word_data.language_id = existing.lesson.language_id
                # merge: example words are auxiliary/derived, not the primary
                # thing the user is creating — preserve silent-merge behavior.
                word = word_service.create(example_word_data, session=session, on_conflict="merge")
                if word:
                    existing.example_words.append(word)

        existing.example_sentences = []
        if data.example_sentences is not None:
            for sentence in data.example_sentences:
                sentence.language_id = existing.lesson.language_id
                passage = passage_service.create(sentence, session=session)
                if passage:
                    existing.example_sentences.append(passage)

        update_data = data.model_dump(exclude={'id', 'lesson_id', 'score', 'difficulty', 'status', 'created_at', 'last_seen_at', 'example_words', 'example_sentences', 'tags', 'sources'}, exclude_none=True)

        for key, value in update_data.items():
            setattr(existing, key, value)

        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated Grammar item: {grammar_id}")
        else:
            logger.error(f"Failed to update Grammar item: {grammar_id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(self, grammar_id: str, session: Optional[Session] = None) -> bool:
        existing = self.get_by_id(grammar_id, session=session)
        if not existing:
            logger.warning(f"Grammar item not found: {grammar_id}")
            return False

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted Grammar item: {grammar_id}")
        else:
            logger.error(f"Failed to delete Grammar item: {grammar_id}")

        return success

    @transactional
    def update_score(
        self,
        grammar_id: str,
        score: float,
        duration_ms: float,
        hint_used: bool = False,
        user_id: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> Score | None:
        grammar = self.get_by_id(grammar_id, session=session)

        if not grammar:
            logger.warning(f"Grammar item not found: {grammar_id}")
            return None

        previous = score_service.get(user_id, grammar_id, session=session)
        previous_score = previous.score if previous else 0.0
        updated = score_service.record(user_id, grammar_id, score, session=session)

        progress_tracking_service.create(
            data=ProgressTrackingDict(
                user_id=user_id,
                language_id=grammar.lesson.language_id,
                element_id=grammar_id,
                element_type="grammar",
                element_status=status_for(grammar_id, updated.score),
                score_before=previous_score,
                score_after=updated.score,
                result=updated.score >= previous_score,
                duration_ms=duration_ms,
                hint_used=hint_used,
            ),
            session=session,
        )

        if updated.score != previous_score:
            lesson_service.update_score(grammar.lesson_id, user_id=user_id, session=session)
            logger.info(f"Updated lesson {grammar.lesson_id} score due to Grammar {grammar_id}")

            if grammar.example_words:
                for word in grammar.example_words:
                    word_service.update_score(word.id, user_id=user_id, session=session)
                    logger.info(f"Updated example Word {word.id} score due to Grammar {grammar_id}")

            if grammar.example_sentences:
                for passage in grammar.example_sentences:
                    passage_service.update_score(passage.id, user_id=user_id, session=session)
                    logger.info(f"Updated example Passage {passage.id} score due to Grammar {grammar_id}")

        return updated
