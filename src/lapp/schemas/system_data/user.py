from datetime import datetime
from typing import Optional
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from pydantic import BaseModel


class UserDict(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    last_review: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_admin: Optional[bool] = None
    blocked: Optional[bool] = None
    preferences: Optional[UserPreferencesDict] = None