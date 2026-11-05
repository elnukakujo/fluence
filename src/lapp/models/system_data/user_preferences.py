from datetime import date
from sqlalchemy import Column, Integer, String, Date, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from ...core.database import Base


class UserPreferences(Base):
    __tablename__ = 'user_preferences'

    id = Column(String, primary_key=True, index=True)
    native_language_iso639_2 = Column(JSON, nullable=False, default=lambda: ["eng"])
    learning_goals = Column(String, default='')
    # Study preferences (null = defaults): vocabulary side mix, per-exercise-type boost/ban, ordered daily-review sections
    voc_side_pattern = Column(JSON, nullable=True)
    exercise_type_prefs = Column(JSON, default=dict, nullable=False)
    review_layout = Column(JSON, nullable=True)
    daily_goal_minutes = Column(Integer, default=20, nullable=False)
    last_updated = Column(Date, default=date.today)
    ai_feedback_enabled = Column(Boolean, default=True, nullable=False)
    ai_learnable_sentence_enabled = Column(Boolean, default=True, nullable=False)
    ai_example_sentence_enabled = Column(Boolean, default=True, nullable=False)
    ai_example_word_enabled = Column(Boolean, default=True, nullable=False)
    ai_tts_enabled = Column(Boolean, default=True, nullable=False)

    # Per-user API config. Blank/None means no API configured — tasks skip the user.
    ai_gen_api_base_url = Column(String, nullable=True)
    ai_gen_api_key = Column(String, nullable=True)
    ai_gen_model = Column(String, nullable=True)
    ai_tts_api_base_url = Column(String, nullable=True)
    ai_tts_api_key = Column(String, nullable=True)
    ai_tts_model = Column(String, nullable=True)

    # Multiple named API endpoints stored as JSON array of dicts:
    # [{"name": "Local Llama", "api_type": "text_gen", "base_url": "...", "api_key": "...", "model": "...", "is_active": true}, ...]
    ai_endpoints = Column(JSON, default=list)

    # Foreign keys
    user_id = Column(String, ForeignKey('user.id'), nullable=False, unique=True)

    # Relationship back to User
    user = relationship(
        "User",
        back_populates="preferences",
        foreign_keys="[UserPreferences.user_id]"
    )
    
    def to_dict(self, include_relations: bool = True) -> dict:
        base = {
            "id": self.id,
            "user_id": self.user_id,
            "native_language_iso639_2": self.native_language_iso639_2,
            "learning_goals": self.learning_goals,
            "voc_side_pattern": self.voc_side_pattern,
            "exercise_type_prefs": self.exercise_type_prefs or {},
            "review_layout": self.review_layout,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "ai_feedback_enabled": self.ai_feedback_enabled,
            "ai_learnable_sentence_enabled": self.ai_learnable_sentence_enabled,
            "ai_example_sentence_enabled": self.ai_example_sentence_enabled,
            "ai_example_word_enabled": self.ai_example_word_enabled,
            "ai_tts_enabled": self.ai_tts_enabled,
            "ai_gen_api_base_url": self.ai_gen_api_base_url,
            "ai_gen_api_key": self.ai_gen_api_key,
            "ai_gen_model": self.ai_gen_model,
            "ai_tts_api_base_url": self.ai_tts_api_base_url,
            "ai_tts_api_key": self.ai_tts_api_key,
            "ai_tts_model": self.ai_tts_model,
            "ai_endpoints": self.ai_endpoints or [],
        }
        if include_relations and self.user:
            base["user"] = self.user.to_dict(include_relations=False)
        return base