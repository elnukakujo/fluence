from typing import Optional
from sqlalchemy.orm import Session
import logging
logger = logging.getLogger(__name__)

from ...models.system_data import UserPreferences
from ...schemas.system_data import UserPreferencesDict
from ...core.database import db_manager, transactional

class UserPreferencesService:
    """Service layer for user preferences CRUD operations.

    This class provides convenience methods around the `UserPreferences` model using the
    project's `db_manager` helpers. Methods return `UserPreferencesDict` instances (the
    pydantic schema) where appropriate. See the method docstrings for guidance.
    """
    def _serialize(self, pref_obj: UserPreferences | None, as_dict: bool, include_relations: bool) -> UserPreferencesDict | UserPreferences | None:
        if not as_dict or pref_obj is None:
            return pref_obj
        return pref_obj.to_dict(include_relations=include_relations)

    @transactional
    def get_by_id(
        self,
        id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> UserPreferences | UserPreferencesDict | None:
        """Get user preferences by ID.

        Args:
            id (str): The ID of the user preferences to retrieve.
            session (Session | None): Optional SQLAlchemy session to use for the query. If None, a new session will be created and managed internally.
            as_dict (bool): If True, return a UserPreferencesDict instance. Otherwise, return a UserPreferences model.
            include_relations (bool): If True, include related objects in the serialized output.

        Returns:
            UserPreferences | UserPreferencesDict | None: The user preferences in the requested format, or None if not found.
        """
        pref = db_manager.find_by_attr(UserPreferences, {"id": id}, session=session)
        return self._serialize(pref, as_dict, include_relations)

    @transactional
    def get_by_user_id(
        self,
        user_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> UserPreferences | UserPreferencesDict | None:
        """Get user preferences by user ID.

        Args:
            user_id (str): The ID of the user whose preferences to retrieve.
            session (Session | None): Optional SQLAlchemy session to use for the query. If None, a new session will be created and managed internally.
            as_dict (bool): If True, return a UserPreferencesDict instance. Otherwise, return a UserPreferences model.
            include_relations (bool): If True, include related objects in the serialized output.

        Returns:
            UserPreferences | UserPreferencesDict | None: The user preferences in the requested format, or None if not found.
        """
        pref = db_manager.find_by_attr(UserPreferences, {"user_id": user_id}, session=session)
        return self._serialize(pref, as_dict, include_relations)

    @transactional
    def create(
        self,
        data: UserPreferencesDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> UserPreferences | UserPreferencesDict:
        """Create user preferences for a given user ID.

        Args:
            data (UserPreferencesDict): The preferences data to create.
            session (Session | None): Optional SQLAlchemy session to use for the operation. If None, a new session will be created and managed internally.
            as_dict (bool): If True, return a UserPreferencesDict instance. Otherwise, return a UserPreferences model.
            include_relations (bool): If True, include related objects in the serialized output.

        Returns:
            UserPreferences | UserPreferencesDict: The created user preferences in the requested format.
        """
        if (existing := db_manager.find_by_attr(model_class=UserPreferences, attr_values={'user_id': data.user_id}, session=session)):
            logger.warning(f"UserPreferences already exists for user {data.user_id}, returning existing preferences with ID {existing.id}")
            return self.update(existing.id, data, session=session, as_dict=as_dict, include_relations=include_relations)

        pref = UserPreferences(
            id=db_manager.generate_new_id(model_class=UserPreferences, session=session),
            user_id=data.user_id,
            native_language_iso639_2=data.native_language_iso639_2,
            learning_goals=data.learning_goals,
            voc_side_pattern=data.voc_side_pattern,
            exercise_type_prefs=data.exercise_type_prefs or {},
            review_layout=data.review_layout,
            daily_goal_minutes=data.daily_goal_minutes,
            ai_feedback_enabled=data.ai_feedback_enabled,
            ai_learnable_sentence_enabled=data.ai_learnable_sentence_enabled,
            ai_example_sentence_enabled=data.ai_example_sentence_enabled,
            ai_example_word_enabled=data.ai_example_word_enabled,
            ai_tts_enabled=data.ai_tts_enabled,
            ai_gen_api_base_url=data.ai_gen_api_base_url,
            ai_gen_api_key=data.ai_gen_api_key,
            ai_gen_model=data.ai_gen_model,
            ai_tts_api_base_url=data.ai_tts_api_base_url,
            ai_tts_api_key=data.ai_tts_api_key,
            ai_tts_model=data.ai_tts_model,
            ai_endpoints=data.ai_endpoints or [],
        )
        result = db_manager.insert(pref, session=session, commit=False)
        if result:
            logger.info(f"Created new UserPreferences object {pref.id} for user {data.user_id}")
        else:
            logger.error(f"Failed to create UserPreferences for user {data.user_id}")

        return self._serialize(pref, as_dict, include_relations)

    @transactional
    def update(
        self,
        id: str,
        data: UserPreferencesDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> UserPreferences | UserPreferencesDict:
        """Update user preferences for a given user ID.

        Args:
            id (str): The ID of the user preferences to update.
            data (UserPreferencesDict): The updated preferences data.
            session (Session | None): Optional SQLAlchemy session to use for the operation. If None, a new session will be created and managed internally.
            as_dict (bool): If True, return a UserPreferencesDict instance. Otherwise, return a UserPreferences model.
            include_relations (bool): If True, include related objects in the serialized output.

        Returns:
            UserPreferences | UserPreferencesDict: The updated user preferences in the requested format.
        """
        user_pref = db_manager.find_by_attr(
            model_class=UserPreferences,
            attr_values={'id': id},
            session=session
        )
        if not user_pref:
            logger.warning(f"UserPreferences with ID {id} not found for update.")
            return None

        # Update fields
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user_pref, field, value)

        result = db_manager.modify(obj=user_pref, session=session, commit=False)

        if result:
            logger.info(f"Updated UserPreferences item with ID: {result.id}")
        else:
            logger.error(f"Failed to update UserPreferences item with ID: {id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(
        self,
        id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Delete user preferences by ID.

        Args:
            id (str): The ID of the user preferences to delete.
            session (Session | None): Optional SQLAlchemy session to use for the operation. If None, a new session will be created and managed internally.

        Returns:
            bool: True if deletion was successful, False otherwise.
        """
        existing = db_manager.get_by_id(UserPreferences, id, session=session)
        if not existing:
            return False

        return db_manager.delete(existing, session=session, commit=False)