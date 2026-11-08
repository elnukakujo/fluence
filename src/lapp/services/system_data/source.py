from sqlalchemy import func
from typing import Optional, Type
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...schemas.system_data import SourceDict
from ...models.system_data import Source
from ...core.database import db_manager, transactional
from ...utils import resolve_element_model


class SourceService:
    """Service layer for source CRUD operations.

    This class provides convenience methods around the `Source` model using the
    project's `db_manager` helpers. Methods return `SourceDict` instances (the
    pydantic schema) where appropriate.
    
    Sources are metadata objects (e.g., textbook, movie, article) that can be
    associated with any element. The `source_type` field describes the source
    category and is independent of element associations.
    """

    def _serialize(self, source_obj: Source | None, as_dict: bool, include_relations: bool) -> SourceDict | dict | None:
        """Convert a Source ORM object to dict or return ORM object based on as_dict flag."""
        if not as_dict or source_obj is None:
            return source_obj
        return source_obj.to_dict(include_relations=include_relations)
    

    @transactional
    def get_by_id(
            self, 
            source_id: str,
            session: Optional[Session] = None,
            as_dict: bool = False,
            include_relations: bool = True
        ) -> Source | dict:
        """Retrieve a source by its ID.

        Returns the `SourceDict` if found, otherwise `None`.
        """
        source_obj = db_manager.get_by_id(Source, source_id, session=session)
        return self._serialize(source_obj, as_dict, include_relations)

    @transactional
    def get_by_user_id(
            self,
            user_id: str,
            session: Optional[Session] = None,
            as_dict: bool = False,
            include_relations: bool = True
        ) -> list[Source] | list[dict]:
        """Return all sources that belong to a given `user_id`.

        Returns an empty list when no sources are found.
        """
        objs = sorted(db_manager.find_all(Source, filters={"user_id": user_id}, session=session), key=lambda o: (o.position, o.created_at or 0))
        return [self._serialize(obj, as_dict, include_relations) for obj in objs]

    @transactional
    def create(
            self,
            source_data: SourceDict,
            session: Optional[Session] = None,
            as_dict: bool = False,
            include_relations: bool = True
        ) -> Source | dict:
        """Create a new source.

        If `source_data.id` is not provided or empty, a new id will be generated
        using `db_manager.generate_new_id(Source)`. Returns the created
        `SourceDict` on success or `None` on failure.
        """
        source_id = getattr(source_data, "id", None) or db_manager.generate_new_id(Source, session=session)
        last = session.query(func.max(Source.position)).filter(Source.user_id == getattr(source_data, "user_id")).scalar()
        source_obj = Source(
            position=0 if last is None else last + 1,
            id=source_id,
            user_id=source_data.user_id,
            title=source_data.title,
            date=source_data.date,
            description=source_data.description,
            source_type=source_data.source_type,
        )

        result = db_manager.insert(obj=source_obj, session=session, commit=False)

        if result:
            logger.info(f"Created new Source item with ID: {result.id}")
        else:
            logger.error(f"Failed to create new Source item: {source_obj.title}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
            self, 
            source_id: str, 
            source_data: SourceDict,
            session: Optional[Session] = None,
            as_dict: bool = False,
            include_relations: bool = True
        ) -> Source | dict:
        """Update an existing source by `source_id`.

        Returns the updated `SourceDict` on success or `None` if the source does not
        exist or the update fails.
        """
        existing = db_manager.get_by_id(Source, source_id, session=session)
        if not existing:
            return None

        # Update fields
        existing.user_id = source_data.user_id
        existing.title = source_data.title
        existing.date = source_data.date
        existing.description = source_data.description
        existing.source_type = source_data.source_type

        modified = db_manager.modify(existing, session=session, commit=False)
        return self._serialize(modified, as_dict, include_relations)

    @transactional
    def delete(
        self, 
        source_id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Delete the source identified by `source_id`.

        Returns `True` when deletion succeeds, `False` otherwise.
        """
        existing = db_manager.get_by_id(Source, source_id, session=session)
        if not existing:
            return False

        return db_manager.delete(existing, session=session, commit=False)

    @transactional
    def ensure_ai_source(self, user_id: str, session: Optional[Session] = None) -> str:
        """Id of the user's single "AI generated" source (shared by every language), created on first use."""
        existing = session.query(Source).filter(Source.user_id == user_id, Source.source_type == "ai").order_by(Source.created_at).first()
        if existing:
            return existing.id
        return self.create(SourceDict(user_id=user_id, title="AI generated", source_type="ai"), session=session).id

    @transactional
    def link_generated_exercises(self, user_id: str, lesson_id: str, session: Optional[Session] = None) -> None:
        """Link the lesson's AI-generated exercises (made before the AI source existed, or just now) to the owner's AI source."""
        from ...models.containers import Lesson
        from ...models.features import Exercise
        lesson = session.get(Lesson, lesson_id)
        if not lesson or lesson.user_id != user_id:
            return
        exercises = session.query(Exercise).filter(Exercise.lesson_id == lesson_id, Exercise.generation_batch_id.isnot(None)).all()
        todo = [e for e in exercises if not any(src.source_type == "ai" for src in e.sources)]
        if not todo:
            return
        ai_id = self.ensure_ai_source(user_id, session=session)
        for e in todo:
            self.add_source_to_element(ai_id, e.id, session=session)

    @transactional
    def add_source_to_element(
        self,
        source_id: str,
        element_id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Associate a source with an element.

        Uses ORM relationships through `db_manager` rather than raw SQL.
        A source can be associated with any element type regardless of source_type.
        """
        source_obj = db_manager.get_by_id(Source, source_id, session=session)
        if not source_obj:
            return False

        element_type = resolve_element_model(element_id)
        if not element_type:
            return False

        element_obj = db_manager.get_by_id(element_type, element_id, session=session)
        if not element_obj:
            return False

        # avoid duplicates
        if any(s.id == source_id for s in element_obj.sources):
            return True

        element_obj.sources.append(source_obj)
        modified = db_manager.modify(element_obj, session=session, commit=False)
        return bool(modified)

    @transactional
    def remove_source_from_element(
        self,
        source_id: str,
        element_id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Remove a source association from an element.

        Uses ORM relationships through `db_manager` rather than raw SQL.
        Returns `True` if association was removed, `False` if not found.
        """
        source_obj = db_manager.get_by_id(Source, source_id, session=session)
        if not source_obj:
            return False

        element_type = resolve_element_model(element_id)
        if not element_type:
            return False

        element_obj = db_manager.get_by_id(element_type, element_id, session=session)
        if not element_obj:
            return False

        if not any(s.id == source_id for s in element_obj.sources):
            return False

        element_obj.sources = [source for source in element_obj.sources if source.id != source_id]
        modified = db_manager.modify(element_obj, session=session, commit=False)
        return bool(modified)