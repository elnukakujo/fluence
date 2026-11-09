from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

import logging

from ...core.database import db_manager, transactional, resolve_related
from ...models.features import Exercise
from ...schemas.features import ExerciseDict
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict
from ...models.system_data import Tag, Source, Score
from ...utils import update_score, update_difficulty, status_for
from ..containers import LessonService
from ..data_collection import ProgressTrackingService
from ..system_data import ScoreService
from .calligraphy import CalligraphyService
from .grammar import GrammarService
from .vocabulary import VocabularyService

logger = logging.getLogger(__name__)

lesson_service = LessonService()
calligraphy_service = CalligraphyService()
grammar_service = GrammarService()
vocabulary_service = VocabularyService()
progress_tracking_service = ProgressTrackingService()
score_service = ScoreService()

class ExerciseService:
    def _serialize(self, exercise: Exercise | None, as_dict: bool, include_relations: bool) -> Exercise | dict | None:
        if not as_dict or exercise is None:
            return exercise
        return exercise.to_dict(include_relations=include_relations)

    def _serialize_list(self, exercises: list[Exercise], as_dict: bool, include_relations: bool) -> list[Exercise] | list[dict]:
        if not as_dict:
            return exercises
        return [exercise.to_dict(include_relations=include_relations) for exercise in exercises]

    def _resolve_associations(
        self,
        calligraphy: Optional[list[str]],
        vocabulary: Optional[list[str]],
        grammar: Optional[list[str]],
        session: Optional[Session],
    ) -> tuple[list, list, list]:
        calligraphies = [
            c
            for cid in (calligraphy or [])
            if (c := calligraphy_service.get_by_id(calligraphy_id=cid, session=session))
        ]
        vocabularies = [
            v
            for vid in (vocabulary or [])
            if (v := vocabulary_service.get_by_id(voc_id=vid, session=session))
        ]
        grammars = [
            g
            for gid in (grammar or [])
            if (g := grammar_service.get_by_id(grammar_id=gid, session=session))
        ]
        return calligraphies, vocabularies, grammars

    @transactional
    def get_all(
        self,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> list[Exercise] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't both be specified: {language_id}, {lesson_id}"
        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            exercises: list[Exercise] = []
            for lesson in lessons:
                exercises.extend(
                    db_manager.find_all(
                        model_class=Exercise,
                        filters={"lesson_id": lesson.id},
                        session=session,
                    )
                )
        elif lesson_id:
            exercises = db_manager.find_all(
                model_class=Exercise,
                filters={"lesson_id": lesson_id},
                session=session,
            )
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id}, {lesson_id}")

        return self._serialize_list(exercises, as_dict, include_relations)

    @transactional
    def get_by_id(
        self,
        ex_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> Exercise | dict | None:
        exercise = db_manager.find_by_attr(
            model_class=Exercise,
            attr_values={"id": ex_id},
            session=session,
        )
        return self._serialize(exercise, as_dict, include_relations)

    @transactional
    def get_by_level(
        self,
        level: str,
        language_id: Optional[str] = None,
        lesson_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> list[Exercise] | list[dict]:
        assert not (language_id and lesson_id), f"language_id and lesson_id can't both be specified: {language_id}, {lesson_id}"

        if language_id:
            lessons = lesson_service.get_all(language_id=language_id, session=session)
            exercises: list[Exercise] = []
            for lesson in lessons:
                exercises.extend(
                    db_manager.find_all(
                        model_class=Exercise,
                        filters={"lesson_id": lesson.id, "level": level},
                        session=session,
                    )
                )
        elif lesson_id:
            exercises = db_manager.find_all(
                model_class=Exercise,
                filters={"lesson_id": lesson_id, "level": level},
                session=session,
            )
        else:
            raise ValueError(f"Requires either language_id or lesson_id but got: {language_id}, {lesson_id}")

        return self._serialize_list(exercises, as_dict, include_relations)

    @transactional
    def create(
        self,
        data: ExerciseDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> Exercise | dict | None:
        lesson = lesson_service.get_by_id(data.lesson_id, session=session)
        if not lesson:
            logger.warning(f"Cannot create exercise, lesson not found: {data.lesson_id}")
            return None

        exercise_data = data.model_dump(exclude={'difficulty', 'status', 'score', 'created_at', 'last_seen_at'}, exclude_none=True)

        related_calligraphy = exercise_data.pop("related_calligraphy", None)
        related_vocabulary = exercise_data.pop("related_vocabulary", None)
        related_grammar = exercise_data.pop("related_grammar", None)

        exercise = Exercise(
            id=db_manager.generate_new_id(model_class=Exercise, session=session),
            lesson_id=lesson.id,
            exercise_type=exercise_data.get("exercise_type"),
            question=exercise_data.get("question"),
            answer=exercise_data.get("answer") or "",
            text_support=exercise_data.get("text_support", ""),
            content=exercise_data.get("content"),
            category=exercise_data.get("category"),
            generation_batch_id=exercise_data.get("generation_batch_id"),
            review_reason=exercise_data.get("review_reason"),
            image_files=data.image_files or [],
            audio_files=data.audio_files or [],
            tags=session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources=session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else []
        )
        exercise.related_calligraphy, exercise.related_vocabulary, exercise.related_grammar = self._resolve_associations(
            calligraphy=related_calligraphy,
            vocabulary=related_vocabulary,
            grammar=related_grammar,
            session=session,
        )

        result = db_manager.insert(obj=exercise, session=session, commit=False)
        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        ex_id: str,
        data: ExerciseDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> Exercise | dict | None:
        existing = self.get_by_id(ex_id, session=session)
        if not existing:
            logger.warning(f"Exercise not found: {ex_id}")
            return None

        update_data = data.model_dump(exclude={'id', 'lesson_id', 'score', 'difficulty', 'status', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)

        related_calligraphy = update_data.pop("related_calligraphy", None)
        related_vocabulary = update_data.pop("related_vocabulary", None)
        related_grammar = update_data.pop("related_grammar", None)

        for key, value in update_data.items():
            setattr(existing, key, value)
        if "category" in data.model_fields_set and data.category is None:
            existing.category = None     # exclude_none above would otherwise make a category impossible to clear
        if "answer" in data.model_fields_set and data.answer is None:
            existing.answer = ""         # the column is NOT NULL: a cleared answer is ""
        if "review_reason" in data.model_fields_set and data.review_reason is None:
            existing.review_reason = None   # accepting a generated exercise clears its reason

        if related_calligraphy is not None or related_vocabulary is not None or related_grammar is not None:
            existing.related_calligraphy, existing.related_vocabulary, existing.related_grammar = self._resolve_associations(
                calligraphy=related_calligraphy,
                vocabulary=related_vocabulary,
                grammar=related_grammar,
                session=session,
            )

        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)
        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(self, ex_id: str, session: Optional[Session] = None) -> bool:
        existing = self.get_by_id(ex_id, session=session)
        if not existing:
            return False
        return db_manager.delete(existing, session=session, commit=False)

    def add_line_audio(self, ex_id: str, line_index: int, api: dict, tts=None) -> dict:
        """Generate, with the user's TTS endpoint, the clip of one line of a reading / dictation and store it
        (appended to audio_files, `audioIndex` set on the line). A line that already has a clip is returned as is.
        Raises FileNotFoundError (no such exercise), ValueError (wrong type / line). TTS failures propagate."""
        from ...utils import get_language_by_iso2t
        from ..containers import LanguageService
        from ..tts import TTSService

        ex = self.get_by_id(ex_id, as_dict=True)
        if not ex:
            raise FileNotFoundError(ex_id)
        content = ex.get("content") or {}
        lines = content.get("lines") if ex.get("exercise_type") in ("reading", "dictation") else None
        if not lines or not (0 <= line_index < len(lines)):
            raise ValueError("not a reading / dictation line")
        files = list(ex.get("audio_files") or [])
        line = lines[line_index]
        if isinstance(line.get("audioIndex"), int) and line["audioIndex"] < len(files):
            return {"audio_files": files, "content": content}

        lesson = lesson_service.get_by_id(ex["lesson_id"], as_dict=True)
        language = LanguageService().get_by_id(lesson["language_id"], as_dict=True)
        iso = get_language_by_iso2t(language["target_iso639_2t"]).iso1 if language.get("target_iso639_2t") else None
        path = (tts or TTSService()).generate_audio(text=line["text"], language_code=iso, api=api)
        files.append(path)
        line["audioIndex"] = len(files) - 1
        self.update(ex_id, ExerciseDict(exercise_type=ex["exercise_type"], question=ex["question"], answer=ex["answer"],
                                        content=content, audio_files=files))
        return {"audio_files": files, "content": content}

    @transactional
    def update_score(
        self,
        ex_id: str,
        score: float,
        duration_ms: float,
        session: Optional[Session] = None,
        hint_used: bool = False,
        attempt_number: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> Score | None:
        exercise = self.get_by_id(ex_id, session=session)
        if not exercise:
            logger.warning(f"Exercise not found: {ex_id}")
            return None

        previous = score_service.get(user_id, ex_id, session=session)
        previous_score = previous.score if previous else 0.0
        updated = score_service.record(user_id, ex_id, score, session=session)

        progress_tracking_service.create(
            data=ProgressTrackingDict(
                user_id=user_id,
                language_id=exercise.lesson.language_id,
                element_id=ex_id,
                element_type="exercise",
                element_status=status_for(ex_id, updated.score),
                score_before=previous_score,
                score_after=updated.score,
                result=updated.score >= previous_score,
                duration_ms=duration_ms,
                hint_used=hint_used,
                attempt_number=attempt_number,
            ),
            session=session,
        )

        for vocabulary in exercise.related_vocabulary:
            vocabulary_service.update_score(
                vocabulary.id, score=score, duration_ms=duration_ms,
                hint_used=hint_used, user_id=user_id, session=session,
            )
            logger.info(f"Updated vocabulary {vocabulary.id} score due to exercise {ex_id}")

        for grammar in exercise.related_grammar:
            grammar_service.update_score(
                grammar.id, score=score, duration_ms=duration_ms,
                hint_used=hint_used, user_id=user_id, session=session,
            )
            logger.info(f"Updated grammar {grammar.id} score due to exercise {ex_id}")

        for calligraphy in exercise.related_calligraphy:
            calligraphy_service.update_score(
                calligraphy.id, score=score, duration_ms=duration_ms,
                hint_used=hint_used, user_id=user_id, session=session,
            )
            logger.info(f"Updated calligraphy {calligraphy.id} score due to exercise {ex_id}")

        return updated
