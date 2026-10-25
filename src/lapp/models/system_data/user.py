from datetime import datetime
from sqlalchemy import Column, ForeignKey, String, DateTime, Boolean, Integer
from sqlalchemy.orm import relationship

from ...core.database import Base


class User(Base):
    __tablename__ = 'user'

    id = Column(String, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=True)
    email = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    last_review = Column(DateTime, nullable=False, default=datetime.now)

    # Auth / admin (see docs/superpowers/specs/2026-10-25-auth-hardening-design.md)
    is_admin = Column(Boolean, nullable=False, default=False)
    blocked = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime, nullable=True)
    failed_login_count = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)

    # One-to-one relationship with UserPreferences
    preferences = relationship("UserPreferences", back_populates="user", uselist=False)

    def to_dict(self, include_relations: bool = True) -> dict:
        base = {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "email": self.email,
            "is_admin": self.is_admin,
            "blocked": self.blocked,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_review": self.last_review.isoformat() if self.last_review else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }
        if include_relations and self.preferences:
            base["preferences"] = self.preferences.to_dict(include_relations=False)
        return base