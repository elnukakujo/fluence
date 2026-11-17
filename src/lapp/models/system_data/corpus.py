from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, String, Text

from ...core.database import Base


class CorpusSentence(Base):
    """A sentence of the local Tatoeba corpus (CC BY 2.0 FR, tatoeba.org). Loaded by `scripts/load_tatoeba.py`; never written by the app."""
    __tablename__ = 'corpus_sentence'

    id = Column(BigInteger, primary_key=True, autoincrement=False)      # Tatoeba's own id
    lang = Column(String, nullable=False, index=True)                   # ISO 639-2/T, as Tatoeba names it ("fra")
    text = Column(Text, nullable=False)


class CorpusLink(Base):
    """`sentence_id` is translated by `translation_id` (Tatoeba's links file, one row per direction)."""
    __tablename__ = 'corpus_link'
    __table_args__ = (Index('ix_corpus_link_sentence', 'sentence_id'),)

    sentence_id = Column(BigInteger, primary_key=True, autoincrement=False)
    translation_id = Column(BigInteger, primary_key=True, autoincrement=False)


class FailureMemory(Base):
    """A lookup that found nothing, remembered so the background task does not retry it every run."""
    __tablename__ = 'failure_memory'

    id = Column(String, primary_key=True, index=True)
    kind = Column(String, nullable=False)           # "example"
    key = Column(String, nullable=False, index=True)  # the element id the lookup was for
    failed_at = Column(DateTime, nullable=False, default=datetime.now)
