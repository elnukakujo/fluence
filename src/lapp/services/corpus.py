"""Example sentences from the local Tatoeba corpus first; the learner's text endpoint only tops up (OA-6/7, DM-42).

Tatoeba (https://tatoeba.org) is CC BY 2.0 FR: every sentence returned carries its attribution.
TODO(owner): coverage of all nine languages and the attribution wording / where it is displayed (spec 4 "Needs the owner" item 4).
"""
import re
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..core.database import db_manager, transactional
from ..models.system_data import CorpusLink, CorpusSentence, FailureMemory
from ..core.languages import language_for

ATTRIBUTION = "Tatoeba.org, CC BY 2.0 FR"
EXAMPLE_RETRY_DAYS = 30        # TODO(owner): stand-in, how long an empty lookup is not retried


def _like_pattern(word: str) -> str:
    return "%" + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


@transactional
def examples_for(word: str, iso1: str, limit: int = 3, source_iso1: Optional[str] = None,
                 session: Optional[Session] = None) -> list[dict]:
    """Shortest sentences of `iso1` containing `word` as a whole word (substring for scripts without spaces), each with the
    translation into `source_iso1` when the corpus has one: `[{text, translation, source: "tatoeba", attribution}]`."""
    word = (word or "").strip()
    if not word or limit < 1:
        return []
    lang = language_for(iso1).iso2
    spaced = bool(re.search(r"\w", word)) and not re.search(r"[぀-ヿ㐀-鿿가-힯]", word)
    q = session.query(CorpusSentence).filter(CorpusSentence.lang == lang, CorpusSentence.text.ilike(_like_pattern(word), escape="\\"))
    rows = q.limit(limit * 20).all()
    if spaced:        # whole word only: "art" must not match "party"
        pattern = re.compile(rf"(?<!\w){re.escape(word)}(?!\w)", re.IGNORECASE)
        rows = [r for r in rows if pattern.search(r.text)]
    rows = sorted(rows, key=lambda r: len(r.text))[:limit]
    out = []
    for r in rows:
        translation = ""
        if source_iso1:
            hit = (session.query(CorpusSentence).join(CorpusLink, CorpusLink.translation_id == CorpusSentence.id)
                   .filter(CorpusLink.sentence_id == r.id, CorpusSentence.lang == language_for(source_iso1).iso2).first())
            translation = hit.text if hit else ""
        out.append({"text": r.text, "translation": translation, "source": "tatoeba", "attribution": ATTRIBUTION})
    return out


@transactional
def recently_failed(kind: str, key: str, session: Optional[Session] = None) -> bool:
    """True when the lookup for `key` came back empty within the last EXAMPLE_RETRY_DAYS."""
    cutoff = datetime.now() - timedelta(days=EXAMPLE_RETRY_DAYS)
    return session.query(FailureMemory).filter(FailureMemory.kind == kind, FailureMemory.key == key, FailureMemory.failed_at >= cutoff).first() is not None


@transactional
def remember_failure(kind: str, key: str, session: Optional[Session] = None) -> None:
    row = session.query(FailureMemory).filter(FailureMemory.kind == kind, FailureMemory.key == key).first()
    if row:
        row.failed_at = datetime.now()
        return
    session.add(FailureMemory(id=db_manager.generate_new_id(model_class=FailureMemory, session=session), kind=kind, key=key))
