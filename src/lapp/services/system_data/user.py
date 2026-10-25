from typing import Optional
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash
import logging
logger = logging.getLogger(__name__)

from ...models.system_data import User
from ...schemas.system_data import UserDict, UserPreferencesDict
from ...core.database import db_manager, transactional
from .user_preferences import UserPreferencesService
user_preferences_service = UserPreferencesService()

class UserService:
    """Service layer for user CRUD operations.

    This class provides convenience methods around the `User` model using the
    project's `db_manager` helpers. Methods return `UserDict` instances (the
    pydantic schema) where appropriate. See the method docstrings for guidance.
    """
    def _serialize(self, user_obj: User | None, as_dict: bool, include_relations: bool) -> UserDict | User | None:
        if not as_dict or user_obj is None:
            return user_obj
        return user_obj.to_dict(include_relations=include_relations)

    @transactional
    def get_all(
            self,
            session: Session | None = None,
            as_dict: bool = False,
            include_relations: bool = True
        ) -> list[UserDict] | list[User]:
        """Get all users.

        Args:
            session (Session | None): Optional SQLAlchemy session to use for the query. If None, a new session will be created and managed internally.
            as_dict (bool): If True, return a list of UserDict instances. Otherwise, return a list of User models.
            include_relations (bool): If True, include related objects in the serialized output.

        Returns:
            list[UserDict] | list[User]: A list of users in the requested format.
        """
        users = db_manager.find_all(User, session=session)
        return [self._serialize(user, as_dict, include_relations) for user in users]

    @transactional
    def get_by_id(
        self,
        user_id: str,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> User | UserDict | None:
        """
        Get a user by its ID.

        Args:
            user_id: The ID of the user to retrieve.

        Returns:
            User object if found, else None
        """
        user = db_manager.find_by_attr(
            model_class=User,
            attr_values={'id': user_id},
            session=session
        )
        return self._serialize(user, as_dict, include_relations)

    @transactional
    def create(
        self,
        user_data: UserDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> User | UserDict:
        """Create a new user.

        Args:
            user_data: A UserDict containing the data for the new user.
            session: An optional SQLAlchemy session to use for the operation.
            as_dict: If True, return a UserDict instance. Otherwise, return a User model.
            include_relations: If True, include related objects in the serialized output.

        Returns:
            The created User object or UserDict, depending on the as_dict flag.
        """
        if not user_data.email:
            raise ValueError("email is required to create a user.")

        if db_manager.find_by_attr(model_class=User, attr_values={"email": user_data.email}, session=session):
            raise ValueError(f"Email already in use: {user_data.email}")

        user_id = getattr(user_data, "id", None) or db_manager.generate_new_id(User, session=session)
        user_obj = User(
            id=user_id,
            username=user_data.username,
            display_name=user_data.display_name,
            email=user_data.email,
            password_hash=generate_password_hash(user_data.password) if user_data.password else None,
        )

        user_obj.preferences = user_preferences_service.create(
            data=UserPreferencesDict(
                user_id=user_id,
                native_language_iso639_2=user_data.preferences.native_language_iso639_2 if user_data.preferences else [],
                learning_goals=user_data.preferences.learning_goals if user_data.preferences else "",
                preferred_exercise_types=user_data.preferences.preferred_exercise_types if user_data.preferences else [],
                daily_goal_minutes=user_data.preferences.daily_goal_minutes if user_data.preferences else 20,
                ai_feedback_enabled=user_data.preferences.ai_feedback_enabled if user_data.preferences else True,
                ai_learnable_sentence_enabled=user_data.preferences.ai_learnable_sentence_enabled if user_data.preferences else True,
                ai_example_sentence_enabled=user_data.preferences.ai_example_sentence_enabled if user_data.preferences else True,
                ai_example_word_enabled=user_data.preferences.ai_example_word_enabled if user_data.preferences else True,
                ai_tts_enabled=user_data.preferences.ai_tts_enabled if user_data.preferences else True,
                # ai_gen_*/ai_tts_* connection fields are intentionally omitted here - they're
                # saved directly via PUT /api/pref/<id> (ConnectionCapability in userForm.tsx),
                # never through this nested construction. Passing them (even as None) would mark
                # them "set" for the exclude_unset update below and wipe out the saved connection.
            ),
            session=session,
        )

        result = db_manager.insert(obj=user_obj, session=session, commit=False)

        if result:
            logger.info(f"Created new User item with ID: {result.id}")
        else:
            logger.error(f"Failed to create new User item: {result.username}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def update(
        self,
        user_id: str,
        update_data: UserDict,
        session: Optional[Session] = None,
        as_dict: bool = False,
        include_relations: bool = True
    ) -> User | UserDict | None:
        """Update an existing user.

        Args:
            user_id: The ID of the user to update.
            update_data: A UserDict containing the updated data for the user.
            session: An optional SQLAlchemy session to use for the operation.
            as_dict: If True, return a UserDict instance. Otherwise, return a User model.
            include_relations: If True, include related objects in the serialized output.

        Returns:
            The updated User object or UserDict, depending on the as_dict flag, or None if the user was not found.
        """
        user = db_manager.find_by_attr(
            model_class=User,
            attr_values={'id': user_id},
            session=session
        )
        if not user:
            logger.warning(f"User with ID {user_id} not found for update.")
            return None

        # Update fields
        user.preferences = user_preferences_service.create(
            data=UserPreferencesDict(
                user_id=user_id,
                native_language_iso639_2=update_data.preferences.native_language_iso639_2 if update_data.preferences else [],
                learning_goals=update_data.preferences.learning_goals if update_data.preferences else "",
                preferred_exercise_types=update_data.preferences.preferred_exercise_types if update_data.preferences else [],
                daily_goal_minutes=update_data.preferences.daily_goal_minutes if update_data.preferences else 20,
                ai_feedback_enabled=update_data.preferences.ai_feedback_enabled if update_data.preferences else True,
                ai_learnable_sentence_enabled=update_data.preferences.ai_learnable_sentence_enabled if update_data.preferences else True,
                ai_example_sentence_enabled=update_data.preferences.ai_example_sentence_enabled if update_data.preferences else True,
                ai_example_word_enabled=update_data.preferences.ai_example_word_enabled if update_data.preferences else True,
                ai_tts_enabled=update_data.preferences.ai_tts_enabled if update_data.preferences else True,
                # ai_gen_*/ai_tts_* connection fields are intentionally omitted here - see the
                # matching comment in create() above.
            ),
            session=session,
        )

        fields = update_data.model_dump(exclude={"id", "preferences"}, exclude_unset=True)
        password = fields.pop("password", None)

        if "email" in fields and fields["email"] != user.email:
            existing = db_manager.find_by_attr(model_class=User, attr_values={"email": fields["email"]}, session=session)
            if existing and existing.id != user_id:
                raise ValueError(f"Email already in use: {fields['email']}")

        for field, value in fields.items():
            setattr(user, field, value)

        if password:
            user.password_hash = generate_password_hash(password)

        result = db_manager.modify(obj=user, session=session, commit=False)

        if result:
            logger.info(f"Updated User item with ID: {result.id}")
        else:
            logger.error(f"Failed to update User item with ID: {user_id}")

        return self._serialize(result, as_dict, include_relations)

    @transactional
    def delete(
        self,
        user_id: str,
        session: Optional[Session] = None
    ) -> bool:
        """Delete a user by its ID.

        Args:
            user_id: The ID of the user to delete.

        Returns:
            True if the user was deleted, False if the user was not found.
        """
        user = db_manager.find_by_attr(
            model_class=User,
            attr_values={'id': user_id},
            session=session
        )

        if not user:
            return False

        # Delete children before parent (FK constraint)
        if user.preferences:
            user_preferences_service.delete(pref_id=user.preferences.id, session=session)

        result = db_manager.delete(user, session=session, commit=False)
        if result:
            logger.info(f"Deleted User item with ID: {user_id}")
        else:
            logger.warning(f"User with ID {user_id} not found for deletion.")
        return result

    @transactional
    def update_password(
        self,
        user_id: str,
        password: str,
        session: Optional[Session] = None,
    ) -> bool:
        """Update a user's password hash. Returns False if user not found."""
        user = db_manager.find_by_attr(
            model_class=User,
            attr_values={'id': user_id},
            session=session
        )
        if not user:
            return False
        user.password_hash = generate_password_hash(password)
        db_manager.modify(obj=user, session=session, commit=False)
        return True