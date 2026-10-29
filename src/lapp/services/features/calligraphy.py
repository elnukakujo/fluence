from datetime import datetime
from typing import Optional

from lapp.utils.helpers import update_difficulty
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.features import CalligraphyDict
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict
from ...models.features import Calligraphy
from ...models.system_data import Source, Tag, Score
from ...core.database import db_manager, transactional, resolve_related, stack_related
from ..containers import LessonService, LanguageService
from ..components import CharacterService, WordService, PassageService
from ..data_collection import ProgressTrackingService
from ..system_data import ScoreService
from ...utils import update_score, status_for

lesson_service = LessonService()
language_service = LanguageService()
character_service = CharacterService()
passage_service = PassageService()
word_service = WordService()
progress_tracking_service = ProgressTrackingService()
score_service = ScoreService()

class CalligraphyService:
    def _serialize(self, calligraphy: Calligraphy | None, as_dict: bool, include_relations: bool) -> Calligraphy | dict | None:
        if not as_dict or calligraphy is None:
            return calligraphy
        return calligraphy.to_dict(include_relations=include_relations)

    def _serialize_list(self, calligraphies: list[Calligraphy], as_dict: bool, include_relations: bool) -> list[Calligraphy] | list[dict]:
        if not as_dict:
            return calligraphies
        return [calligraphy.to_dict(include_relations=include_relations) for calligraphy in calligraphies]

    @transactional
    def get_all(
        self,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Calligraphy] | list[dict]:
        """
        Get all calligraphies for a specific language or lesson.

        Args:
            language_id (Optional[str]=None): The id of the language to get all the calligraphies from
            lesson_id (Optional[str]=None): The id of the lesson to get all the calligraphies from
        Returns:
            List of Calligraphy objects
        """
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)

            calligraphies = []
            for lesson in lessons:
                calligraphies.extend(
                    db_manager.find_all(
                        model_class=Calligraphy,
                        filters={'lesson_id': lesson.id},
                        session=session
                    )
                )
            return self._serialize_list(calligraphies, as_dict, include_relations)
        elif lesson_id:
            calligraphies = db_manager.find_all(
                model_class=Calligraphy,
                filters={'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(calligraphies, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def get_by_id(
        self,
        calligraphy_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Calligraphy | dict | None:
        """
        Get a Calligraphy item by its ID.

        Args:
            calligraphy_id: The ID of the Calligraphy item to retrieve.

        Returns:
            Calligraphy object if found, else None
        """
        calligraphy = db_manager.find_by_attr(
            model_class=Calligraphy,
            attr_values={'id': calligraphy_id},
            session=session
        )
        return self._serialize(calligraphy, as_dict, include_relations)

    @transactional
    def get_by_level(
        self,
        level: int,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Calligraphy] | list[dict]:
        """
        Get all Calligraphy items of a specific level among a language.
        
        Args:
            language_id: The id of the language to filter Calligraphy items
            lesson_id: The id of the lesson to filter Calligraphy items
            level: Calligraphy level (e.g., 0, 1, 2, etc.)
        
        Returns:
            List of matching Calligraphy objects
        """
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"

        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)

            calligraphies = []
            for lesson in lessons:
                calligraphies.extend(
                    db_manager.find_all(
                        model_class=Calligraphy,
                        filters={'level':level ,'lesson_id': lesson.id},
                        session=session
                    )
                )
            return self._serialize_list(calligraphies, as_dict, include_relations)
        elif lesson_id:
            calligraphies = db_manager.find_all(
                model_class=Calligraphy,
                filters={'level': level, 'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(calligraphies, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def create(
        self,
        data: CalligraphyDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
        on_conflict: Optional[str] = None,
    ) -> Calligraphy | dict | None:
        """
        Create a new Calligraphy item.

        Args:
            data: CalligraphyDict containing calligraphy item details.
            on_conflict: Forwarded to CharacterService.create() for the
                underlying character — None raises DuplicateEntityError on an
                existing character for this language so the caller can ask
                the user; "keep" / "overwrite" / "merge" resolve it directly.
                See CharacterService.create.

        Returns:
            Created Calligraphy object if successful, else None
        """
        lesson = lesson_service.get_by_id(data.lesson_id, session=session)

        if not lesson:
            logger.warning(f"Cannot create Calligraphy item, lesson not found: {data.lesson_id}")
            return None

        if data.character is not None:
            data.character.language_id = lesson.language_id
            character = character_service.create(data.character, session=session, on_conflict=on_conflict)
            if not character:
                logger.error(f"Failed to create character for calligraphy")
                return None

        example_words = []
        if data.example_words is not None:
            for example_word_data in data.example_words:
                example_word_data.language_id = lesson.language_id
                # merge: example words are auxiliary/derived, not the primary
                # thing the user is creating — preserve silent-merge behavior.
                word = word_service.create(example_word_data, session=session, on_conflict="merge")
                if word:
                    example_words.append(word)

        example_sentences = []
        if data.example_sentences is not None:
            for example_sentence_data in data.example_sentences:
                example_sentence_data.language_id = lesson.language_id
                sentence = passage_service.create(example_sentence_data, session=session)
                if sentence:
                    example_sentences.append(sentence)

        existing_calligraphy = (
            session.query(Calligraphy)
            .filter(Calligraphy.character_id == character.id, Calligraphy.lesson_id == lesson.id)
            .first()
            if on_conflict else None
        )

        if existing_calligraphy:
            if on_conflict == "merge":
                existing_calligraphy.tags = stack_related(existing_calligraphy.tags, data.tags, Tag, session)
                existing_calligraphy.sources = stack_related(existing_calligraphy.sources, data.sources, Source, session)
            elif on_conflict == "overwrite":
                existing_calligraphy.tags = resolve_related(data.tags, Tag, session)
                existing_calligraphy.sources = resolve_related(data.sources, Source, session)
            # "keep": leave existing_calligraphy's lists untouched
            existing_calligraphy.example_words = example_words or existing_calligraphy.example_words
            existing_calligraphy.example_sentences = example_sentences or existing_calligraphy.example_sentences
            result = db_manager.modify(existing_calligraphy, session=session, commit=False)

            if result:
                logger.info(f"Merged into existing Calligraphy item: {result.id}")
            else:
                logger.error(f"Failed to merge Calligraphy item: {existing_calligraphy.id}")

            return self._serialize(result, as_dict, include_relations)

        calligraphy = Calligraphy(
            id=db_manager.generate_new_id(
                model_class=Calligraphy,
                session=session
            ),
            lesson_id=lesson.id,
            character_id=character.id,
            character=character,
            example_words=example_words,
            example_sentences=example_sentences,
            tags=resolve_related(data.tags, Tag, session),
            sources=resolve_related(data.sources, Source, session),
        )

        result = db_manager.insert(obj=calligraphy, session=session, commit=False)

        if result:
            logger.info(f"Created new Calligraphy item with ID: {result.id}")
        else:
            logger.error(f"Failed to create new Calligraphy item")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        calligraphy_id: str,
        data: CalligraphyDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Calligraphy | dict | None:
        """
        Update an existing Calligraphy item.

        Args:
            calligraphy_id: The ID of the Calligraphy item to update.
            data: calligraphyDict containing updated Calligraphy item details.

        Returns:
            Updated Calligraphy object if successful, else None
        """
        existing = self.get_by_id(calligraphy_id, session=session)

        if not existing:
            logger.warning(f"Calligraphy item not found: {calligraphy_id}")
            return None

        if data.character is not None:
            data.character.language_id = existing.character.language_id if existing.character else None
            updated_character = character_service.update(existing.character_id, data.character, session=session)
            if not updated_character:
                logger.error(f"Failed to update character for calligraphy: {calligraphy_id}")
                return None
            existing.character = updated_character

        existing.example_words = []
        if data.example_words is not None:
            for example_word_data in data.example_words:
                example_word_data.language_id = existing.lesson.language_id
                word = word_service.create(example_word_data, session=session, on_conflict="merge")
                if word:
                    existing.example_words.append(word)

        existing.example_sentences = []
        if data.example_sentences is not None:
            for example_sentence_data in data.example_sentences:
                example_sentence_data.language_id = existing.character.language_id
                sentence = passage_service.create(example_sentence_data, session=session)
                if sentence:
                    existing.example_sentences.append(sentence)

        update_data = data.model_dump(exclude={'id', 'lesson_id', 'score', 'difficulty', 'status', 'created_at', 'last_seen_at', 'character', 'example_words', 'example_sentences', 'tags', 'sources'}, exclude_none=True)

        for key, value in update_data.items():
            setattr(existing, key, value)

        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated Calligraphy item: {calligraphy_id}")
        else:
            logger.error(f"Failed to update Calligraphy item: {calligraphy_id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(self, calligraphy_id: str, session: Optional[Session] = None) -> bool:
        """
        Delete a Calligraphy item by its ID.

        Args:
            calligraphy_id: The ID of the Calligraphy item to delete.
        Returns:
            True if deletion was successful, else False
        """
        existing = self.get_by_id(calligraphy_id, session=session)

        if not existing:
            logger.warning(f"Calligraphy item not found: {calligraphy_id}")
            return False

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted Calligraphy item: {calligraphy_id}")
        else:
            logger.error(f"Failed to delete Calligraphy item: {calligraphy_id}")

        return success

    @transactional
    def update_score(
        self,
        calligraphy_id: str,
        score: float,
        duration_ms: float,
        hint_used: bool = False,
        user_id: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> Score | None:
        """
        Update Calligraphy item score based on average of all of its components scores.
        
        This should be called whenever a component's score changes.
        
        Args:
            calligraphy_id: The ID of the Calligraphy item to update
            score: The new score for the Calligraphy item
        
        Returns:
            Updated Calligraphy object if successful, None otherwise
        """
        calligraphy = self.get_by_id(calligraphy_id, session=session)

        if not calligraphy:
            logger.warning(f"Calligraphy item not found: {calligraphy_id}")
            return None

        previous = score_service.get(user_id, calligraphy_id, session=session)
        previous_score = previous.score if previous else 0.0
        updated = score_service.record(user_id, calligraphy_id, score, session=session)

        progress_tracking_service.create(
            data=ProgressTrackingDict(
                user_id=user_id,
                language_id=calligraphy.lesson.language_id,
                element_id=calligraphy_id,
                element_type="calligraphy",
                element_status=status_for(calligraphy_id, updated.score),
                score_before=previous_score,
                score_after=updated.score,
                result=updated.score >= previous_score,
                duration_ms=duration_ms,
                hint_used=hint_used,
            ),
            session=session,
        )

        if updated.score != previous_score:
            lesson_service.update_score(calligraphy.lesson_id, user_id=user_id, session=session)
            logger.info(f"Updated lesson {calligraphy.lesson_id} score due to calligraphy {calligraphy_id}")

            character_service.update_score(char_id=calligraphy.character_id, user_id=user_id, session=session)
            logger.info(f"Updated character {calligraphy.character_id} score due to calligraphy {calligraphy_id}")

            if calligraphy.example_words:
                for word in calligraphy.example_words:
                    word_service.update_score(word_id=word.id, user_id=user_id, session=session)
                    logger.info(f"Updated example word {word.id} score due to calligraphy {calligraphy_id}")

            if calligraphy.example_sentences:
                for passage in calligraphy.example_sentences:
                    passage_service.update_score(passage_id=passage.id, user_id=user_id, session=session)
                    logger.info(f"Updated example sentence {passage.id} score due to calligraphy {calligraphy_id}")

        return updated
