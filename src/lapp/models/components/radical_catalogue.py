from sqlalchemy import Column, Integer, String, UniqueConstraint

from ...core.database import Base


class RadicalCatalogue(Base):
    """Global read-only radical catalogue, per target language (iso639_2t). A learner gets an entry by copying it
    into their own DB as an ordinary Character (DM-49). Empty until `scripts/load_radical_catalogue.py` is given a file."""
    __tablename__ = "radical_catalogue"
    __table_args__ = (UniqueConstraint("language_iso", "character", name="uq_radical_catalogue_language_character"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    language_iso = Column(String, nullable=False, index=True)
    character = Column(String, nullable=False)
    phonetic = Column(String, nullable=True)
    meaning = Column(String, nullable=True)
    strokes = Column(Integer, nullable=True)
