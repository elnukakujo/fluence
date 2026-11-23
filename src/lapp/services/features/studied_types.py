"""Which types a language studies (DM-46, SG-14): the course's `element_types` setting, as the one lookup every surface of the language uses.

A type that is off is absent from lists, menus, queues, associations, generation, parsing and scores of that language; its data is kept and comes
back when the type is switched on again. Use this module, never `resolve(..., "element_types")` on its own.
"""
from typing import Optional

from sqlalchemy.orm import Session

from ...core.database import transactional
from ..system_data.settings import resolve

ALL = ("vocabulary", "grammar", "calligraphy", "exercise")
_STORED = {"exercises": "exercise"}          # the setting spells the exercise type in the plural


@transactional
def studied_types(user_id: str, language_id: Optional[str], session: Optional[Session] = None) -> list[str]:
    """The studied types of a language, in canonical order. Never empty: the setting itself must keep at least one."""
    wanted = {_STORED.get(t, t) for t in resolve(user_id, language_id, "element_types", session=session)}
    return [t for t in ALL if t in wanted]


def is_studied(kind: str, user_id: str, language_id: Optional[str], session: Optional[Session] = None) -> bool:
    return kind in studied_types(user_id, language_id, session=session)
