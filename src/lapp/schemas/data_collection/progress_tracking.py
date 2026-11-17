from typing import Optional

from ..base import BaseDataCollectionDict, BaseElementDict

class ProgressTrackingDict(BaseDataCollectionDict):
    element_type: Optional[str] = None
    element_status: Optional[str] = None
    score_before: Optional[float] = None
    score_after: Optional[float] = None
    result: Optional[bool] = None
    duration_ms: Optional[float] = None
    hint_used: Optional[bool] = None
    attempt_number: Optional[int] = None
    daily_goal_reached_before: Optional[bool] = None

    element_id: Optional[str] = None