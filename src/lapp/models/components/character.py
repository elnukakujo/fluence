from sqlalchemy import JSON, Column, Integer, String, UniqueConstraint
from sqlalchemy.orm import object_session, relationship

from ..base import BaseComponentModel, character_word_link, character_passage_link

class Character(BaseComponentModel):
    __tablename__ = 'character'
    __mapper_args__ = {"polymorphic_identity": "character"}
    __table_args__ = (UniqueConstraint('language_id', 'character', name='uq_character_language_character'),)
    
    character = Column(String, nullable=False, index=True)
    phonetic = Column(String, nullable=True)
    meaning = Column(String, nullable=True)
    radical = Column(String, nullable=True)
    strokes = Column(Integer, nullable=True)
    # Spec 2 Task 9. `readings`: [{kind, value, primary}] (kind is a free string per language, TODO(owner)).
    readings = Column(JSON, nullable=False, default=list)
    key_radical_id = Column(String, nullable=True)    # a Character of the same language (checked in the service, no FK)
    components = Column(JSON, nullable=False, default=list)    # ordered Character ids of the same language, no cycles
    
    # Relationship
    calligraphy = relationship('Calligraphy', back_populates='character')  # One to One

    words = relationship(
        'Word',
        secondary=character_word_link,
        back_populates='characters'
    )
    passages = relationship(
        'Passage',
        secondary=character_passage_link,
        back_populates='characters'
    )

    def to_dict(self, include_relations: bool = True) -> dict:
        base_dict =  {
            **super().to_dict(include_relations=False),
            "character": self.character,
            "meaning": self.meaning,
            "phonetic": self.phonetic,
            "radical": self.radical,
            "strokes": self.strokes,
            "readings": self.readings or [],
            "key_radical_id": self.key_radical_id,
            "components": self.components or [],
        }
        # The radical and the components with their glyph, so a card can show them without a second request (the review queue,
        # the flashcards, the sheets). ponytail: one `get` per link (the session caches them); a join if a queue ever gets slow.
        session = object_session(self)
        if session is not None:
            def ref(i):
                c = session.get(Character, i)
                return {"id": c.id, "character": c.character} if c else None
            base_dict["key_radical"] = ref(self.key_radical_id) if self.key_radical_id else None
            base_dict["component_refs"] = [r for r in map(ref, self.components or []) if r]
        if include_relations:
            base_dict.update({
                "calligraphy": [c.to_dict(include_relations=False) for c in self.calligraphy],
                "words": [w.to_dict(include_relations=False) for w in self.words],
                "passages": [p.to_dict(include_relations=False) for p in self.passages]
            })
        return base_dict