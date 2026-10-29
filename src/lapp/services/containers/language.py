from datetime import datetime
from os import name
from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.containers import LanguageDict
from ...models.system_data import Source, Tag
from ...models.containers import Language, Lesson
from ...core.database import db_manager, transactional, resolve_related
from ..system_data import ScoreService

score_service = ScoreService()

class LanguageService:
    def _serialize(self, language: Language | None, as_dict: bool, include_relations: bool) -> Language | dict | None:
        if not as_dict or language is None:
            return language
        return language.to_dict(include_relations=include_relations)

    def _serialize_list(self, languages: list[Language], as_dict: bool, include_relations: bool) -> list[Language] | list[dict]:
        if not as_dict:
            return languages
        return [language.to_dict(include_relations=include_relations) for language in languages]

    def _check_current_lesson(self, language: Language, current_lesson_id: str, session: Optional[Session] = None) -> bool:
        """
        Check if the current lesson ID is valid for the given language.

        Args:
            language: The Language object.
            current_lesson_id: The current lesson ID to validate.
        Returns:
            True if valid, False otherwise.
        """
        from .lesson import LessonService
        lesson_service = LessonService()
        if (lesson := lesson_service.get_by_id(current_lesson_id, session=session)):
            return lesson.id
        new_current_lesson_id = self._find_current_lesson(language.id, score_threshold=0.75, session=session)

        language.current_lesson_id = new_current_lesson_id
        db_manager.modify(language, session=session, commit=False)
        return new_current_lesson_id
    
    def _find_current_lesson(self, language_id: str, score_threshold: float, user_id: Optional[str] = None, session: Optional[Session] = None) -> Optional[str]:
        """
        Find the first lesson ID for a given language with a score below a certain threshold.

        Args:
            language_id: The ID of the language.
            score_threshold: The score threshold to compare against.
            user_id: The user whose score rows to read; defaults to the language owner.
            session: Optional SQLAlchemy session.

        Returns:
            The ID of the first lesson below the threshold, or None if all lessons meet/exceed the threshold.
        """
        from .lesson import LessonService
        lesson_service = LessonService()

        lessons = lesson_service.get_all(
            language_id=language_id,
            session=session
        )
        if user_id is None:
            lang = db_manager.find_by_attr(Language, {'id': language_id}, session=session)
            user_id = lang.user_id if lang else None
        lesson_ids = [lesson.id for lesson in lessons]
        score_map = score_service.get_many(user_id, lesson_ids, session=session)
        for lesson in lessons:
            s = score_map.get(lesson.id)
            if s is None or s.score < score_threshold*100:
                return lesson.id
        return lessons[-1].id if lessons else None
        
    @transactional
    def get_by_user_id(
        self,
        user_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Language] | list[dict]:
        """
        Get all languages for a specific user.

        Args:
            user_id: The ID of the user.
            session: Optional SQLAlchemy session.
            as_dict: Whether to return dictionaries instead of objects.
            include_relations: Whether to include related objects.

        Returns:
            List of Language objects
        """
        languages = db_manager.find_all(
            model_class=Language,
            filters={'user_id': user_id},
            session=session
        )
        for language in languages:
            language.current_lesson_id = self._check_current_lesson(
                language=language,
                current_lesson_id=language.current_lesson_id,
                session=session
            )

        # Stable creation order: oldest first.
        languages.sort(key=lambda language: language.created_at)

        if not as_dict:
            return languages
        return self._serialize_list(languages, as_dict, include_relations)

    @transactional
    def get_by_id(
        self,
        language_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Language | dict | None:
        """
        Get a language by its ID.

        Args:
            language_id: The ID of the language to retrieve.

        Returns:
            Language object if found, else None
        """
        language = db_manager.find_by_attr(
            model_class=Language,
            attr_values={'id': language_id},
            session=session
        )
        logger.info(f"Retrieved language with ID {language_id}")
        if language:
            language.current_lesson_id = self._check_current_lesson(
                language=language,
                current_lesson_id=language.current_lesson_id,
                session=session
            )
        return self._serialize(language, as_dict, include_relations)

    @transactional
    def get_by_level(
        self,
        level: int,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Language] | list[dict]:
        """
        Get all languages of a specific level.
        
        Args:
            level: Language level (e.g., 0, 1, 2, etc.)
        
        Returns:
            List of matching Language objects
        """
        languages = db_manager.find_all(
            model_class=Language,
            filters={'level': level},
            session=session
        )
        for language in languages:
            language.current_lesson_id = self._check_current_lesson(
                language=language,
                current_lesson_id=language.current_lesson_id,
                session=session
            )
        return self._serialize_list(languages, as_dict, include_relations)
    
    @transactional
    def create(
        self,
        data: LanguageDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Language | dict | None:
        """
        Create a new language.

        Args:
            data: LanguageDict containing language details.

        Returns:
            Created Language object if successful, else None
        """
        language = Language(
            id=db_manager.generate_new_id(model_class=Language, session=session),
            user_id=data.user_id,
            name=data.name,
            alias=data.alias,
            flag=data.flag,
            level=data.level,
            description=data.description,
            source_iso639_2t=data.source_iso639_2t,
            target_iso639_2t=data.target_iso639_2t,
            tags=session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources=session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else []
        )

        result = db_manager.insert(obj=language, session=session, commit=False)

        # Create also the Commitment Log entry for this language
        from ..data_collection.commitment_log import CommitmentLogService
        commitment_log_service = CommitmentLogService()
        commitment_log_service.create(
            user_id=data.user_id,
            language_id=language.id,
            session=session
        )

        if result:
            logger.info(f"Created new language with ID: {result.id}")
        else:
            logger.error(f"Failed to create new language: {language.name}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        language_id: str,
        data: LanguageDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Language | dict | None:
        """
        Update an existing language.

        Args:
            language_id: The ID of the language to update.
            data: LanguageDict containing updated language details.

        Returns:
            Updated Language object if successful, else None
        """
        existing = self.get_by_id(language_id, session=session)

        if not existing:
            logger.warning(f"Language not found: {language_id}")
            return None

        update_data = data.model_dump(exclude={'current_lesson_id', 'id', 'user_id', 'score', 'status', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)

        for key, value in update_data.items():
            if value is not None:
                setattr(existing, key, value)

        existing.current_lesson_id = self._check_current_lesson(
            language=existing,
            current_lesson_id=existing.current_lesson_id,
            session=session
        )

        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated language: {language_id}")
        else:
            logger.error(f"Failed to update language: {language_id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(self, language_id: str, session: Optional[Session] = None) -> bool:
        """
        Delete a language by its ID.

        Args:
            language_id: The ID of the language to delete.

        Returns:
            True if deletion was successful, else False
        """
        existing = self.get_by_id(language_id, session=session)

        if not existing:
            logger.warning(f"Language not found: {language_id}")
            return False

        # Clear the circular current_lesson_id FK before deleting, or the lesson
        # delete violates fk_language_current_lesson_id.
        existing.current_lesson_id = None
        session.flush()

        # ponytail: delete dependent rows (FK to language, no DB cascade)
        from ...models.data_collection import CommitmentLog, DailyStats, ProgressTracking
        for model in (CommitmentLog, DailyStats, ProgressTracking):
            rows = db_manager.find_all(
                model_class=model,
                filters={'language_id': language_id},
                session=session,
            )
            for row in (rows or []):
                db_manager.delete(row, session=session, commit=False)

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted language: {language_id}")
        else:
            logger.error(f"Failed to delete language: {language_id}")

        return success

    @transactional
    def update_score(self, language_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> "Score | None":
        """
        Update language score based on average of all lesson scores.
        
        This should be called whenever a lesson's score changes.
        
        Args:
            language_id: The ID of the language to update
        
        Returns:
            Updated Language object if successful, None otherwise
        """
        language = self.get_by_id(language_id, session=session)

        if not language:
            logger.warning(f"Language not found: {language_id}")
            return None

        lessons = db_manager.find_all(
            model_class=Lesson,
            filters={'language_id': language_id},
            session=session
        )

        lesson_ids = [l.id for l in lessons]
        score_map = score_service.get_many(user_id, lesson_ids, session=session)
        if lesson_ids:
            total_score = sum(score_map[lid].score if lid in score_map else 0.0 for lid in lesson_ids)
            total_difficulty = sum(score_map[lid].difficulty if lid in score_map else 0.5 for lid in lesson_ids)
            language_score = round(total_score / len(lesson_ids), 2)
            language_difficulty = total_difficulty / len(lesson_ids)
        else:
            logger.warning(f"No lessons found for language: {language_id}")
            language_score = 0.0
            language_difficulty = 0.5

        current_lesson_id = self._find_current_lesson(
            language_id=language.id,
            score_threshold=0.75,
            user_id=user_id,
            session=session
        )

        result = score_service.set(user_id, language_id, language_score, language_difficulty,
                                   current_lesson_id=current_lesson_id, session=session)

        if result:
            logger.info(f"Updated language {language_id} score: {result.score}")

        return result
