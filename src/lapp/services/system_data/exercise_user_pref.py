from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional
from ...models.system_data import ExerciseUserPref, UserPreferences

MODES = ("boost", "ban")


def effective_mode(type_prefs: Optional[dict], exercise_type: str, exercise_mode: Optional[str]) -> Optional[str]:
    """Ban wins over boost, whichever of the type / the exercise says it."""
    modes = {(type_prefs or {}).get(exercise_type), exercise_mode}
    return "ban" if "ban" in modes else "boost" if "boost" in modes else None


class ExerciseUserPrefService:
    @transactional
    def set(self, user_id: str, exercise_id: str, mode: Optional[str], session: Optional[Session] = None) -> None:
        """Set a user's own mode on an exercise; None removes it."""
        if mode is not None and mode not in MODES:
            raise ValueError(f"mode must be one of {MODES} or null")
        row = session.query(ExerciseUserPref).filter_by(user_id=user_id, exercise_id=exercise_id).first()
        if mode is None:
            if row:
                session.delete(row)
        elif row:
            row.mode = mode
        else:
            session.add(ExerciseUserPref(id=db_manager.generate_new_id(ExerciseUserPref, session=session),
                                         user_id=user_id, exercise_id=exercise_id, mode=mode))
        session.flush()

    @transactional
    def modes_for(self, user_id: str, exercise_ids: list[str], session: Optional[Session] = None) -> dict[str, str]:
        if not exercise_ids:
            return {}
        rows = session.query(ExerciseUserPref).filter(
            ExerciseUserPref.user_id == user_id, ExerciseUserPref.exercise_id.in_(exercise_ids)).all()
        return {r.exercise_id: r.mode for r in rows}

    @transactional
    def type_prefs(self, user_id: str, session: Optional[Session] = None) -> dict:
        pref = session.query(UserPreferences).filter_by(user_id=user_id).first()
        return (pref.exercise_type_prefs if pref else None) or {}

    @transactional
    def annotate(self, user_id: str, exercises: list[dict], session: Optional[Session] = None) -> list[dict]:
        """Add `user_mode` (exercise-level) and `banned` (effective, incl. type ban) to serialized exercises."""
        modes = self.modes_for(user_id, [e["id"] for e in exercises if e.get("id")], session=session)
        type_prefs = self.type_prefs(user_id, session=session)
        for e in exercises:
            own = modes.get(e.get("id"))
            e["user_mode"] = own
            e["banned"] = effective_mode(type_prefs, e.get("exercise_type"), own) == "ban"
            e["boosted"] = effective_mode(type_prefs, e.get("exercise_type"), own) == "boost"
        return exercises
