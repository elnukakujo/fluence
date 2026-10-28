from sqlalchemy import Column, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import select, func
from collections import defaultdict

from ...core.database import Base, db_manager
from ..base import tag_element_link


class Tag(Base):
    __tablename__ = 'tag'
    __table_args__ = (UniqueConstraint('user_id', 'name', name='uq_tag_user_name'),)

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('user.id'), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String)
    description = Column(String)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)

    def get_elements(self) -> dict:
        # Reuse self's own session rather than leaking an unclosed one from
        # db_manager.get_session() (see the equivalent comment on
        # BaseElementModel.get_progress_tracking in models/base.py).
        from sqlalchemy.orm import object_session
        session = object_session(self) or db_manager.get_session()
        linked_ids = [
            row.element_id for row in session.execute(
                select(tag_element_link.c.element_id).where(
                    tag_element_link.c.tag_id == self.id
                )
            )
        ]

        if not linked_ids:
            return {}

        from ...utils.resolve_orm_table import resolve_element_labels
        labels = resolve_element_labels(session, linked_ids)

        bucketed = defaultdict(list)
        for id_ in linked_ids:
            type_name = id_.split("_")[0]
            bucketed[type_name].append({"id": id_, "label": labels.get(id_)})

        return dict(bucketed)

    def to_dict(self, include_relations: bool = True) -> dict:
        base = {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "color": self.color,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_relations:
            base["elements"] = self.get_elements()
        return base