from typing import Optional

import logging
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.data_collection.progress_tracking import ProgressTracking
from ...schemas.data_collection.progress_tracking import ProgressTrackingDict

logger = logging.getLogger(__name__)

class ProgressTrackingService:
    def _serialize(
        self,
        entry: ProgressTracking | None,
        as_dict: bool,
        include_relations: bool,
    ) -> ProgressTracking | dict | None:
        if not as_dict or entry is None:
            return entry
        return entry.to_dict(include_relations=include_relations)

    def _serialize_list(
        self,
        entries: list[ProgressTracking],
        as_dict: bool,
        include_relations: bool,
    ) -> list[ProgressTracking] | list[dict]:
        if not as_dict:
            return entries
        return [entry.to_dict(include_relations=include_relations) for entry in entries]

    @transactional
    def get_by_id(
        self,
        progress_tracking_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> ProgressTracking | dict | None:
        """Get a ProgressTracking entry by its ID."""
        entry = db_manager.find_by_attr(
            model_class=ProgressTracking,
            attr_values={"id": progress_tracking_id},
            session=session,
        )
        return self._serialize(entry, as_dict, include_relations)

    @transactional
    def create(
        self,
        data: ProgressTrackingDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True,
    ) -> ProgressTracking | dict | None:
        entry = ProgressTracking(
            id=db_manager.generate_new_id(model_class=ProgressTracking, session=session),
            user_id=data.user_id,
            language_id=data.language_id,
            element_id=data.element_id,
            element_type=data.element_type,
            element_status=data.element_status,
            score_before=data.score_before,
            score_after=data.score_after,
            result=data.result,
            duration_ms=data.duration_ms,
            hint_used=data.hint_used,
            attempt_number=data.attempt_number,
            daily_goal_reached_before=data.daily_goal_reached_before,
        )

        result = db_manager.insert(obj=entry, session=session, commit=False)
        return self._serialize(result, as_dict, include_relations)
