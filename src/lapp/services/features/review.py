from difflib import SequenceMatcher
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

import logging
logger = logging.getLogger(__name__)

from ...core.database import transactional
from ...models.components import Word
from ...models.data_collection import ProgressTracking
from ..system_data import ScoreService
from ..system_data.prefs_view import prefs_for
from ..system_data.score import side_id
from ...utils.element_kinds import kind_of
from .study_constants import LEECH_CANDIDATES, LEECH_CONFUSABLE_RATIO, SPARE_EXERCISES  # noqa: F401  (SPARE_EXERCISES: tests patch it here)

from .review_queue import (  # noqa: F401  (re-exported: tests and callers import the helpers from here)
    Scope, build_queue, card_seconds, collect_candidates, item_skill, order_bucket, pair_vocabulary, plan_budgets, quotas,
    section_budgets, section_minutes,
)


class ReviewService:
    """On-the-fly selection of the daily review queue for a language.

    No persisted SRS state: every card's "should review now" priority is
    computed from fields it already has (created_at / last_seen_at / difficulty
    / score) via review_priority(). The queue interleaves the three flashcard
    types and is capped by the user's daily_goal_minutes.
    """

    @transactional
    def get_review_cards(
        self,
        language_id: str,
        user_id: Optional[str] = None,
        session: Optional[Session] = None,
        as_dict: bool = True,
        scope: Optional[Scope] = None,
    ) -> list:
        cands = collect_candidates(user_id, language_id, scope or Scope(), session)
        if cands is None:
            return []
        prefs = prefs_for(cands.user_id, language_id, session)
        budgets = plan_budgets(cands, prefs, None, None)
        queue, sections, spares = build_queue(cands, budgets)
        if as_dict:
            # A few more ready exercises ride along (not part of the queue) to replace a card the learner can't do.
            est = lambda c: card_seconds(c, budgets.paces)
            return [{**self._card_dict(card, cands.lesson_title_by_id, cands.bonus_ids), "section": sec, "spare": spare, "est_seconds": round(est(card), 1)}
                    for card, sec, spare in [*((c, s, False) for c, s in zip(queue, sections)), *((c, "ex", True) for c in spares)]]
        return queue

    @transactional
    def annotate_leeches(self, cards: list[dict], user_id: str, language_id: str, session: Optional[Session] = None) -> list[dict]:
        """Add `leech` ({lapses, is_leech, parts, confusable}) to the vocabulary and calligraphy cards the score engine flags as leeches
        (any score level; the card stays in the queue). `lapses` = progress rows with score_after < score_before."""
        ids = {c["id"] for c in cards if str(c.get("id", "")).startswith(("voc_", "call_"))}
        if not ids:
            return cards
        flagged = {c["id"] for c in ScoreService().merge(user_id, [{"id": i} for i in ids], session=session) if c["is_leech"]}
        if not flagged:
            return cards
        lapses = dict(session.query(ProgressTracking.element_id, func.count()).filter(
            ProgressTracking.user_id == user_id, ProgressTracking.element_id.in_(flagged), ProgressTracking.score_after < ProgressTracking.score_before,
        ).group_by(ProgressTracking.element_id).all())
        from ...models.system_data import Score
        rows = session.query(Score).filter(Score.user_id == user_id, Score.is_leech.is_(True), Score.element_id.in_(
            [*flagged, *(side_id(i, sd) for i in flagged if i.startswith("voc_") for sd in ("front", "back"))])).all()
        streak = {}      # correct answers in a row at the end of the leech's recent answers (it leaves at LEECH_LEAVE_IN_ROW)
        for r in rows:
            base = r.element_id.split("#")[0]
            n = len(r.recent) - len(r.recent.rstrip("1"))
            streak[base] = min(streak.get(base, n), n)
        for card in cards:
            if card.get("id") in flagged:
                n = lapses.get(card["id"], 0)
                word = session.get(Word, card["word_id"]) if card.get("word_id") else None
                card["leech"] = {"lapses": n, "is_leech": True, "correct_in_row": streak.get(card["id"], 0),
                                 "parts": [{"character": ch.character, "phonetic": ch.phonetic, "meaning": ch.meaning} for ch in word.characters] if word else [],
                                 "confusable": self._confusable(word, language_id, session) if word else None}
        return cards

    @staticmethod
    def _confusable(word, language_id: str, session: Session) -> dict | None:
        """The other word of the language that looks (or sounds, tones aside) most like `word`; one with the same translation is a synonym, not a confusion."""
        import unicodedata
        plain = lambda s: "".join(c for c in unicodedata.normalize("NFD", (s or "").casefold()) if not unicodedata.combining(c) and not c.isdigit() and not c.isspace())
        best, best_ratio = None, 0.0
        for other in session.query(Word).filter(Word.language_id == language_id, Word.id != word.id).limit(LEECH_CANDIDATES):
            if (other.translation or "").casefold() == (word.translation or "").casefold():
                continue
            ratio = SequenceMatcher(None, word.word, other.word).ratio()
            if word.phonetic and plain(other.phonetic) == plain(word.phonetic):
                ratio = max(ratio, 1.0)
            if ratio >= LEECH_CONFUSABLE_RATIO and ratio > best_ratio:
                best, best_ratio = other, ratio
        return {"word": best.word, "translation": best.translation} if best else None

    @staticmethod
    def _card_dict(card, lesson_title_by_id, bonus_ids=frozenset()) -> dict:
        side = None
        if isinstance(card, tuple):
            card, side = card
        out = {**card.to_dict(include_relations=True), "lesson_title": lesson_title_by_id.get(card.lesson_id),
               "kind": kind_of(card.id).name.lower(), "skill": item_skill(card.id, side), "bonus": card.id in bonus_ids}
        if side:
            out["side"] = side
            out["card_id"] = side_id(card.id, side)
        return out
