from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped

from ..base import BaseContainerModel
from .lesson import Lesson

class Language(BaseContainerModel):
    __tablename__ = 'language'
    __mapper_args__ = {"polymorphic_identity": "language"}
    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_language_user_name'),)

    name = Column(String, nullable=False, index=True)
    alias = Column(String)
    flag = Column(String, default="")

    source_iso639_2t = Column(String, nullable=True, default="eng")
    target_iso639_2t = Column(String, nullable=True)

    # One-to-many: all lessons belonging to this language
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson",
        back_populates="language",
        cascade="all, delete-orphan",
        foreign_keys=[Lesson.language_id],
    )

    # Components (word/passage/character) belong to the language too; cascade
    # them on delete so removing a language (or a user) cleans them up.
    words: Mapped[list["Word"]] = relationship(
        "Word", cascade="all, delete-orphan", foreign_keys="Word.language_id",
    )
    passages: Mapped[list["Passage"]] = relationship(
        "Passage", cascade="all, delete-orphan", foreign_keys="Passage.language_id",
    )
    characters: Mapped[list["Character"]] = relationship(
        "Character", cascade="all, delete-orphan", foreign_keys="Character.language_id",
    )

    def to_dict(self, include_relations: bool = True) -> dict:
        base_dict =  {
            **super().to_dict(include_relations),
            "name": self.name,
            "alias": self.alias,
            "flag": self.flag,
            "source_iso639_2t": self.source_iso639_2t,
            "target_iso639_2t": self.target_iso639_2t,
        }

        if include_relations:
            base_dict.update({
                "lesson_ids": [lesson.id for lesson in self.lessons],
            })
        base_dict["collaborators"] = self._collaborator_names()

        return base_dict

    def _collaborator_names(self) -> list[str]:
        from sqlalchemy.orm import object_session
        from ...core.database import db_manager
        from ...models.system_data import Collaboration, User
        session = object_session(self) or db_manager.get_session()
        collabs = session.query(Collaboration).filter(
            Collaboration.target_type == "language",
            Collaboration.target_id == self.id,
            Collaboration.status == "accepted",
        ).all()
        user_ids = [c.collaborator_id for c in collabs]
        if not user_ids:
            return []
        users = session.query(User).filter(User.id.in_(user_ids)).all()
        return [u.display_name or u.username for u in users]