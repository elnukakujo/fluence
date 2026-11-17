from sqlalchemy import func
from datetime import datetime
from os import name
from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.containers import LanguageDict
from ...models.system_data import LessonGate, Source, Tag
from ...utils.scoring import KNOWN_FROM
from ...models.containers import Language, Lesson
from ...core.database import db_manager, transactional, resolve_related
from ..system_data import ScoreService
from ..system_data.score_cascade import refresh

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

    def _find_current_lesson(self, language_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> Optional[str]:
        """The language's current lesson (DM-18, SC-13): the first lesson that is not known yet (score below `KNOWN_FROM`).

        Once the soft gate opened, the lesson it opened on counts as known for good (DM-46: decay never undoes it).
        When every lesson is known, the last one. None for a language without lessons."""
        from .lesson import LessonService
        lessons = LessonService().get_all(language_id=language_id, session=session)
        if user_id is None:
            lang = db_manager.find_by_attr(Language, {'id': language_id}, session=session)
            user_id = lang.user_id if lang else None
        gate = db_manager.find_by_attr(LessonGate, {'user_id': user_id, 'language_id': language_id}, session=session)
        score_map = score_service.get_many(user_id, [lesson.id for lesson in lessons], session=session)
        for lesson in lessons:
            if gate is not None and lesson.id == gate.unlocked_lesson_id:
                continue
            s = score_map.get(lesson.id)
            if s is None or s.score < KNOWN_FROM:
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

        languages.sort(key=lambda language: (language.position, language.created_at))

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
        logger.debug(f"Retrieved language with ID {language_id}")
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
        from ...core.languages import language_for, language_for_iso2
        supported = language_for(data.iso1) if data.iso1 else language_for_iso2(data.target_iso639_2t)
        if supported is None:
            raise ValueError("a course needs a supported language (iso1)")
        if session.query(Language).filter(Language.user_id == data.user_id, Language.iso1 == supported.iso1).first():
            raise ValueError(f"you already have a {supported.name} course")
        data.iso1, data.target_iso639_2t = supported.iso1, supported.iso2
        data.name = data.name or supported.name
        data.flag = data.flag or supported.flag
        last = session.query(func.max(Language.position)).filter(Language.user_id == data.user_id).scalar()
        language = Language(
            position=0 if last is None else last + 1,
            id=db_manager.generate_new_id(model_class=Language, session=session),
            user_id=data.user_id,
            name=data.name,
            alias=data.alias,
            iso1=data.iso1,
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
    def reorder(self, user_id: str, ids: list[str], session: Optional[Session] = None) -> bool:
        """Give the user's languages the order of `ids`, which must be exactly their own language ids (once each)."""
        languages = {l.id: l for l in session.query(Language).filter(Language.user_id == user_id).all()}
        if not ids or len(ids) != len(set(ids)) or set(ids) != set(languages):
            return False
        for position, language_id in enumerate(ids):
            languages[language_id].position = position
        return True

    @transactional
    def bulk_delete(self, ids: list[str], session: Optional[Session] = None) -> int:
        """Delete several languages (and their collaborations) in the caller's transaction; returns how many were deleted."""
        from ..system_data import CollaborationService
        deleted = 0
        for language_id in ids:
            CollaborationService().purge_target("language", language_id, session=session)
            deleted += bool(self.delete(language_id, session=session))
        return deleted

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

        update_data = data.model_dump(exclude={'iso1', 'target_iso639_2t', 'current_lesson_id', 'id', 'user_id', 'score', 'status', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)

        for key, value in update_data.items():
            if value is not None:
                setattr(existing, key, value)

        if data.iso1 and existing.iso1 is None:
            # A course the registry migration could not match: the owner picks its supported language once.
            from ...core.languages import language_for
            supported = language_for(data.iso1)
            if session.query(Language).filter(Language.user_id == existing.user_id, Language.iso1 == supported.iso1).first():
                raise ValueError(f"you already have a {supported.name} course")
            existing.iso1, existing.target_iso639_2t = supported.iso1, supported.iso2

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
    def update_score(self, language_id: str, user_id: Optional[str] = None, touch: bool = True, session: Optional[Session] = None) -> "Score | None":
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

        current_lesson_id = self._find_current_lesson(language_id=language.id, user_id=user_id, session=session)

        result = refresh(user_id, language_id, lesson_ids, digits=1, touch=touch,
                         current_lesson_id=current_lesson_id, session=session)

        if result:
            logger.info(f"Updated language {language_id} score: {result.score}")

        return result
