from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.features import VocabularyDict
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict
from ...models.features import Vocabulary
from ...models.system_data import Tag, Source, Score
from ..containers import LessonService, LanguageService
from ..components import WordService, PassageService
from ..data_collection import ProgressTrackingService
from ..system_data import ScoreService
from ...core.database import db_manager, transactional, resolve_related, stack_related
from ...utils import update_score, update_difficulty, stack_lists, status_for

lesson_service = LessonService()
language_service = LanguageService()
word_service = WordService()
passage_service = PassageService()
progress_tracking_service = ProgressTrackingService()
score_service = ScoreService()


class VocabularyService:
    def _serialize(self, vocabulary: Vocabulary | None, as_dict: bool, include_relations: bool) -> Vocabulary | dict | None:
        if not as_dict or vocabulary is None:
            return vocabulary
        return vocabulary.to_dict(include_relations=include_relations)

    def _serialize_list(self, vocabularies: list[Vocabulary], as_dict: bool, include_relations: bool) -> list[Vocabulary] | list[dict]:
        if not as_dict:
            return vocabularies
        return [vocabulary.to_dict(include_relations=include_relations) for vocabulary in vocabularies]

    @transactional
    def get_all(
        self,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Vocabulary] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            vocabulary = []
            for lesson in lessons:
                vocabulary.extend(
                    db_manager.find_all(
                        model_class=Vocabulary,
                        filters={'lesson_id': lesson.id},
                        session=session
                    )
                )
            return self._serialize_list(vocabulary, as_dict, include_relations)
        elif lesson_id:
            vocabulary = db_manager.find_all(
                model_class=Vocabulary,
                filters={'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(vocabulary, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def get_by_id(
        self,
        voc_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Vocabulary | dict | None:
        vocabulary = db_manager.find_by_attr(
            model_class=Vocabulary,
            attr_values={'id': voc_id},
            session=session
        )
        return self._serialize(vocabulary, as_dict, include_relations)

    @transactional
    def get_by_level(
        self,
        language_id: Optional[str],
        lesson_id: Optional[str],
        level: int,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> list[Vocabulary] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't be both specified, but got: {language_id} and {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            vocabulary = []
            for lesson in lessons:
                vocabulary.extend(
                    db_manager.find_all(
                        model_class=Vocabulary,
                        filters={'lesson_id': lesson.id, 'level': level},
                        session=session
                    )
                )
            return self._serialize_list(vocabulary, as_dict, include_relations)
        elif lesson_id:
            vocabulary = db_manager.find_all(
                model_class=Vocabulary,
                filters={'level': level, 'lesson_id': lesson_id},
                session=session
            )
            return self._serialize_list(vocabulary, as_dict, include_relations)
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id} and {lesson_id}")

    @transactional
    def create(
        self,
        data: VocabularyDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
        on_conflict: Optional[str] = None,
    ) -> Vocabulary | dict | None:
        """Create a new vocabulary item.

        Args:
            on_conflict: Forwarded to WordService.create() for the underlying
                word — None raises DuplicateEntityError on an existing word
                for this language so the caller can ask the user; "keep" /
                "overwrite" / "merge" resolve it directly. See WordService.create.
        """
        lesson = lesson_service.get_by_id(data.lesson_id, session=session)
        if not lesson:
            logger.warning(f"Cannot create vocabulary item, lesson not found: {data.lesson_id}")
            return None

        data.word.language_id = lesson.language_id
        word = word_service.create(data.word, session=session, on_conflict=on_conflict)
        if not word:
            logger.error(f"Failed to create word for vocabulary")
            return None

        example_sentences = []
        for example_sentence in (data.example_sentences or []):
            example_sentence.language_id = lesson.language_id
            passage = passage_service.create(example_sentence, session=session)
            if passage:
                example_sentences.append(passage)

        existing_vocabulary = (
            session.query(Vocabulary)
            .filter(Vocabulary.word_id == word.id, Vocabulary.lesson_id == data.lesson_id)
            .first()
            if on_conflict else None
        )

        if existing_vocabulary:
            if on_conflict == "merge":
                existing_vocabulary.image_files = stack_lists(existing_vocabulary.image_files, data.image_files)
                existing_vocabulary.audio_files = stack_lists(existing_vocabulary.audio_files, data.audio_files)
                existing_vocabulary.tags = stack_related(existing_vocabulary.tags, data.tags, Tag, session)
                existing_vocabulary.sources = stack_related(existing_vocabulary.sources, data.sources, Source, session)
            elif on_conflict == "overwrite":
                existing_vocabulary.image_files = data.image_files or []
                existing_vocabulary.audio_files = data.audio_files or []
                existing_vocabulary.tags = resolve_related(data.tags, Tag, session)
                existing_vocabulary.sources = resolve_related(data.sources, Source, session)
            # "keep": leave existing_vocabulary's lists untouched
            existing_vocabulary.example_sentences = example_sentences or existing_vocabulary.example_sentences
            result = db_manager.modify(existing_vocabulary, session=session, commit=False)

            if result:
                logger.info(f"Merged into existing VocabularyFeature item: {result.id}")
            else:
                logger.error(f"Failed to merge VocabularyFeature item: {existing_vocabulary.id}")

            return self._serialize(result, as_dict, include_relations)

        vocabulary = Vocabulary(
            id=db_manager.generate_new_id(model_class=Vocabulary, session=session),
            word_id=word.id,
            lesson_id=data.lesson_id,
            image_files=data.image_files or [],
            audio_files=data.audio_files or [],
            example_sentences=example_sentences,
            tags=resolve_related(data.tags, Tag, session),
            sources=resolve_related(data.sources, Source, session),
        )

        result = db_manager.insert(obj=vocabulary, session=session, commit=False)

        if result:
            logger.info(f"Created new VocabularyFeature item with ID: {result.id}")
        else:
            logger.error(f"Failed to create new VocabularyFeature item: {word.word}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        voc_id: str,
        data: VocabularyDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> Vocabulary | dict | None:
        existing = self.get_by_id(voc_id, session=session)
        if not existing:
            logger.warning(f"VocabularyFeature item not found: {voc_id}")
            return None

        if data.word is not None:
            data.word.language_id = existing.lesson.language_id
            if existing.word and data.word.word == existing.word.word:
                # same word, no text change — a plain edit of the linked
                # word, not a duplicate to resolve, so replace (not union)
                # its media/tags/sources.
                word = word_service.update(existing.word_id, data.word, session=session)
            else:
                # merge: changing the word's text could collide with a
                # different existing word — preserve the old silent-merge
                # behavior for that case rather than surfacing a conflict
                # on every text edit.
                word = word_service.create(data.word, session=session, on_conflict="merge")
            if word:
                existing.word = word
                existing.word_id = word.id

        existing.example_sentences = []
        if data.example_sentences is not None:
            for example_sentence_data in data.example_sentences:
                example_sentence_data.language_id = existing.lesson.language_id if existing.lesson else None
                passage = passage_service.create(example_sentence_data, session=session)
                if passage:
                    existing.example_sentences.append(passage)

        update_data = data.model_dump(exclude={'id', 'lesson_id', 'score', 'difficulty', 'status', 'created_at', 'last_seen_at', 'word', 'word_id', 'example_sentences', 'tags', 'sources'}, exclude_none=True)

        for key, value in update_data.items():
            setattr(existing, key, value)

        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated VocabularyFeature item: {voc_id}")
        else:
            logger.error(f"Failed to update VocabularyFeature item: {voc_id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(self, voc_id: str, session: Optional[Session] = None) -> bool:
        existing = self.get_by_id(voc_id, session=session)
        if not existing:
            logger.warning(f"VocabularyFeature item not found: {voc_id}")
            return False

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted VocabularyFeature item: {voc_id}")
        else:
            logger.error(f"Failed to delete VocabularyFeature item: {voc_id}")

        return success

    @transactional
    def update_score(
        self,
        voc_id: str,
        score: float,
        duration_ms: float,
        hint_used: bool = False,
        user_id: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> Score | None:
        vocabulary = self.get_by_id(voc_id, session=session)
        if not vocabulary:
            logger.warning(f"VocabularyFeature item not found: {voc_id}")
            return None

        previous = score_service.get(user_id, voc_id, session=session)
        previous_score = previous.score if previous else 0.0
        updated = score_service.record(user_id, voc_id, score, session=session)

        progress_tracking_service.create(
            data=ProgressTrackingDict(
                user_id=user_id,
                language_id=vocabulary.lesson.language_id,
                element_id=voc_id,
                element_type="vocabulary",
                element_status=status_for(voc_id, updated.score),
                score_before=previous_score,
                score_after=updated.score,
                result=updated.score >= previous_score,
                duration_ms=min(duration_ms, 10*60*1000),
                hint_used=hint_used,
            ),
            session=session,
        )

        if updated.score != previous_score:
            lesson_service.update_score(vocabulary.lesson_id, user_id=user_id, session=session)
            logger.info(f"Updated lesson {vocabulary.lesson_id} score due to VocabularyFeature {voc_id}")

            word_service.update_score(vocabulary.word_id, user_id=user_id, session=session)
            logger.info(f"Updated word {vocabulary.word_id} score due to VocabularyFeature {voc_id}")

            if vocabulary.example_sentences:
                for passage in vocabulary.example_sentences:
                    passage_service.update_score(passage.id, user_id=user_id, session=session)
                    logger.info(f"Updated passage {passage.id} score due to VocabularyFeature {voc_id}")

        return updated
