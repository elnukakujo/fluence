import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ...schemas.components import CharacterDict
from ...models.components import Character
from ...models.containers import Language
from ...core.database import db_manager, transactional, stack_related, resolve_related
from ...core.exceptions import DuplicateEntityError
from ...models.system_data import Tag, Source
from ...utils import enrich_character, get_language_by_iso2t, stack_lists
from ..system_data import ScoreService

score_service = ScoreService()


class CharacterService:
    @transactional
    def get_all(self, session: Optional[Session] = None) -> list[Character]:
        """Get all characters."""
        return db_manager.find_all(model_class=Character, session=session)

    @transactional
    def get_by_id(self, character_id: str, session: Optional[Session] = None) -> Character | None:
        """Get a character by its ID."""
        return db_manager.find_by_attr(
            model_class=Character, attr_values={'id': character_id}, session=session
        )

    @transactional
    def get_by_character(self, character: str, language_id: Optional[str] = None, session: Optional[Session] = None) -> Character | None:
        """Get a character by its character value (optionally scoped to a language)."""
        filters = {'character': character}
        if language_id:
            filters['language_id'] = language_id
        return db_manager.find_by_attr(model_class=Character, attr_values=filters, session=session)

    @transactional
    def create(
        self,
        data: CharacterDict,
        session: Optional[Session] = None,
        on_conflict: Optional[str] = None,
    ) -> Character | None:
        """Create a new character.

        Args:
            on_conflict: How to resolve an existing character for this
                language: None (default) raises DuplicateEntityError so the
                caller can ask the user; "keep" returns the existing row
                unchanged; "overwrite" recomputes it from `data` + fresh
                enrichment, ignoring the existing value entirely; "merge"
                fills only what's missing, preferring `data` over the
                existing value over enrichment (the prior silent-upsert
                behavior).
        """
        if existing := self.get_by_character(data.character, language_id=data.language_id, session=session):
            if on_conflict is None:
                raise DuplicateEntityError(
                    entity_type="character",
                    existing=existing.to_dict(include_relations=False),
                    incoming=data.model_dump(exclude_none=True),
                )
            if on_conflict == "keep":
                logger.info(f"Character already exists: {data.character} with ID: {existing.id}; keeping existing")
                return existing
            if on_conflict not in ("overwrite", "merge"):
                raise ValueError(f"Invalid on_conflict value: {on_conflict}")

            logger.info(f"Character already exists: {data.character} with ID: {existing.id}; resolving as {on_conflict}")
            return self.update(
                character_id=existing.id, data=data, session=session,
                force=(on_conflict == "overwrite"), resolving_conflict=True,
            )

        language = db_manager.find_by_attr(model_class=Language, attr_values={"id": data.language_id}, session=session)

        source_iso1 = get_language_by_iso2t(language.source_iso639_2t).iso1 if language else None
        target_iso1 = get_language_by_iso2t(language.target_iso639_2t).iso1 if language else None

        enriched_data = enrich_character(character_text=data.character, target_iso1=target_iso1, source_iso1=source_iso1)

        character = Character(
            id=db_manager.generate_new_id(model_class=Character, session=session),
            **{k: v for k, v in data.model_dump(exclude={'id', 'status', 'score', 'created_at', 'last_seen_at', 'phonetic', 'radical', 'meaning'}, exclude_none=True).items()},
            phonetic=data.phonetic if (data.phonetic is not None and data.phonetic != "") else enriched_data["phonetic"],
            radical=data.radical if (data.radical is not None and data.radical != "") else enriched_data["radical"],
            meaning=data.meaning if (data.meaning is not None and data.meaning != "") else enriched_data["meaning"],
            tags = session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources = session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else []
        )
        result = db_manager.insert(obj=character, session=session, commit=False)

        if result:
            logger.info(f"Created new character with ID: {result.id}")
        else:
            logger.error(f"Failed to create new character: {character.character}")

        return result

    @transactional
    def update(
        self,
        character_id: str,
        data: CharacterDict,
        session: Optional[Session] = None,
        force: bool = False,
        resolving_conflict: bool = False,
    ) -> Character | None:
        """Update an existing character.

        Args:
            force: If True ("overwrite" conflict resolution), the existing
                row's values are never consulted — a field is `data`'s value
                if given, else freshly re-enriched. If False (default), a
                missing field falls back to the existing value first, then
                to enrichment — a "merge", not a replace.
            resolving_conflict: If True (resolving a create() duplicate),
                image_files/audio_files/tags/sources are the UNION of
                existing + incoming rather than incoming replacing existing
                outright — none of those are something the user picks one
                version of, both sets are kept. score/difficulty/created_at/
                last_seen_at are never touched here regardless (see
                update_data's exclude below) — they always keep the
                existing value.
        """
        existing = self.get_by_id(character_id, session=session)

        if not existing:
            logger.warning(f"Character not found: {character_id}")
            return None

        update_data = data.model_dump(exclude={'id', 'language_id', 'difficulty', 'status', 'score', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)
        logger.info(f"Update data for character {character_id}: {update_data}")

        if update_data['character'] != existing.character and (existing_character := self.get_by_character(update_data['character'], language_id=existing.language_id, session=session)) and existing_character.id != character_id:
            logger.warning(f"Character with value '{update_data['character']}' already exists.")
            raise ValueError(f"Character with value '{update_data['character']}' already exists.")

        language = db_manager.find_by_attr(model_class=Language, attr_values={"id": existing.language_id}, session=session)

        source_iso1 = get_language_by_iso2t(language.source_iso639_2t).iso1 if language else None
        target_iso1 = get_language_by_iso2t(language.target_iso639_2t).iso1 if language else None

        enriched_data = enrich_character(character_text=update_data['character'], target_iso1=target_iso1, source_iso1=source_iso1)

        def resolve(field: str, existing_val):
            provided = update_data.get(field)
            if provided is not None and (force or provided != ""):
                return provided
            if force:
                return enriched_data.get(field)
            return existing_val if existing_val is not None and existing_val != "" else enriched_data.get(field)

        existing.character = update_data.get('character', existing.character)
        existing.phonetic = resolve('phonetic', existing.phonetic)
        existing.radical = resolve('radical', existing.radical)
        existing.meaning = resolve('meaning', existing.meaning)
        existing.strokes = update_data.get('strokes', existing.strokes)
        if resolving_conflict:
            existing.audio_files = stack_lists(existing.audio_files, update_data.get('audio_files'))
            existing.image_files = stack_lists(existing.image_files, update_data.get('image_files'))
            existing.tags = stack_related(existing.tags, data.tags, Tag, session)
            existing.sources = stack_related(existing.sources, data.sources, Source, session)
        else:
            existing.audio_files = update_data.get('audio_files', existing.audio_files)
            existing.image_files = update_data.get('image_files', existing.image_files)
            if data.tags is not None:
                existing.tags = resolve_related(data.tags, Tag, session)
            if data.sources is not None:
                existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated character: {character_id}")
        else:
            logger.error(f"Failed to update character: {character_id}")

        return result

    @transactional
    def delete(self, character_id: str, session: Optional[Session] = None) -> bool:
        """Delete a character by its ID."""
        existing = self.get_by_id(character_id, session=session)

        if not existing:
            logger.warning(f"Character not found: {character_id}")
            return False

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted character: {character_id}")
        else:
            logger.error(f"Failed to delete character: {character_id}")

        return success

    @transactional
    def update_score(self, char_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> "Score | None":
        character = self.get_by_id(char_id, session=session)
        if not character:
            logger.warning(f"Character not found: {char_id}")
            return None

        features = [*character.calligraphy]
        feature_ids = [f.id for f in features]
        score_map = score_service.get_many(user_id, feature_ids, session=session)
        if feature_ids:
            total_score = sum(score_map[fid].score if fid in score_map else 0.0 for fid in feature_ids)
            total_difficulty = sum(score_map[fid].difficulty if fid in score_map else 0.5 for fid in feature_ids)
            character_score = total_score / len(feature_ids)
            character_difficulty = total_difficulty / len(feature_ids)
        else:
            logger.warning(f"No features found for character: {char_id}")
            character_score = 0.0
            character_difficulty = 0.5

        result = score_service.set(user_id, char_id, character_score, character_difficulty, session=session)
        if result:
            logger.info(f"Updated CharacterComponent {char_id} score to {result.score} and difficulty to {result.difficulty}")

        return result