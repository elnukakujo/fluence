from sqlalchemy import Column, String, JSON
from sqlalchemy.orm import relationship

from ..base import BaseFeatureModel, exercise_calligraphy_link, exercise_grammar_link, exercise_vocabulary_link

class Exercise(BaseFeatureModel):
    __tablename__ = 'exercise'
    __mapper_args__ = {"polymorphic_identity": "exercise"}

    exercise_type = Column(String, nullable=False, index=True)  # e.g., multiple choice, fill
    question = Column(String, nullable=False, index=True)
    answer = Column(String, nullable=False)
    text_support = Column(String, default="")   # e.g., additional text information
    category = Column(String, nullable=True)  # exam-section slug (listening, reading, ...); the client owns the per-language table, never validated here
    generation_batch_id = Column(String, nullable=True, index=True)  # set on AI-generated exercises: one id per generation run
    review_reason = Column(String, nullable=True)  # why a generated exercise awaits review; set = not ready until accepted
    content = Column(JSON, nullable=True)  # structured data for type_in_the_blank/select_in_the_blank/matching/organize/true_false/quizz
    
    related_vocabulary = relationship('Vocabulary', secondary=exercise_vocabulary_link)
    related_calligraphy = relationship('Calligraphy', secondary=exercise_calligraphy_link)
    related_grammar = relationship('Grammar', secondary=exercise_grammar_link)
    
    @property
    def needs(self) -> list[str]:
        """What the user still has to provide before this exercise can be practised ([] = ready).
        A generated exercise waits for review; its content must fit its type (else the runner would crash);
        a dictation needs a clip for every line."""
        from ...services.ingestion.elements import conversation_json_ok, exercise_content_ok, reading_stored_ok   # local: services import models
        needs = ["review"] if self.review_reason else []
        try:
            fits = (conversation_json_ok(self.question, self.answer) if self.exercise_type == "conversation"   # the runner reads question/answer
                    else reading_stored_ok(self.content) if self.exercise_type == "reading"   # stored shape differs from the model's
                    else exercise_content_ok(self.exercise_type, self.content))
        except Exception:   # a malformed shape is "not ready", never an error
            fits = False
        if not fits:
            needs.append("content")
        if self.exercise_type != "dictation":
            return needs
        files = self.audio_files or []
        lines = (self.content or {}).get("lines") or []
        ok = all(isinstance(l.get("audioIndex"), int) and 0 <= l["audioIndex"] < len(files) for l in lines)
        return needs if lines and ok else needs + ["audio"]

    def to_dict(self, include_relations: bool = True) -> dict:
        base_dict = {
            **super().to_dict(include_relations=include_relations),
            "exercise_type": self.exercise_type,
            "question": self.question,
            "text_support": self.text_support,
            "answer": self.answer,
            "content": self.content,
            "category": self.category,
            "generation_batch_id": self.generation_batch_id,
            "review_reason": self.review_reason,
            "needs": self.needs,
            "related_vocabulary": [v.id for v in self.related_vocabulary],
            "related_calligraphy": [c.id for c in self.related_calligraphy],
            "related_grammar": [g.id for g in self.related_grammar],
        }
        return base_dict