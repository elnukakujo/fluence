from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column

from ..base import BaseContainerModel

class Lesson(BaseContainerModel):
    __tablename__ = 'lesson'
    __mapper_args__ = {"polymorphic_identity": "lesson"}

    title = Column(String, index=True)

    # Foreign key
    language_id: Mapped[str] = mapped_column(ForeignKey('language.id'))

    # Relationships
    language: Mapped["Language"] = relationship(
        "Language",
        back_populates="lessons",
        foreign_keys=[language_id],
    )
    calligraphy: Mapped[list["Calligraphy"]] = relationship(
        "Calligraphy",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )
    grammar: Mapped[list["Grammar"]] = relationship(
        "Grammar",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )
    vocabulary: Mapped[list["Vocabulary"]] = relationship(
        "Vocabulary",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )
    exercise: Mapped[list["Exercise"]] = relationship(
        "Exercise",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )

    def to_dict(self, include_relations: bool = True) -> dict:
        base_dict =  {
            **super().to_dict(include_relations=include_relations),
            "title": self.title
        }

        if include_relations:
            base_dict.update({
                "language_id": self.language_id,
                "calligraphy": [calligraphy.id for calligraphy in self.calligraphy],
                "grammar": [grammar.id for grammar in self.grammar],
                "vocabulary": [vocab.id for vocab in self.vocabulary],
                "exercise_ids": [ex.id for ex in self.exercise]
            })
        base_dict["collaborators"] = self._collaborator_names()
        return base_dict

    def _collaborator_names(self) -> list[str]:
        from sqlalchemy.orm import object_session
        from ...core.database import db_manager
        from ...models.system_data import LessonShare, User
        session = object_session(self) or db_manager.get_session()
        shares = session.query(LessonShare).filter(LessonShare.lesson_id == self.id).all()
        user_ids = [sh.user_id for sh in shares]
        if not user_ids:
            return []
        users = session.query(User).filter(User.id.in_(user_ids)).all()
        return [u.display_name or u.username for u in users]