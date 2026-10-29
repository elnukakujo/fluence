import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ...core.database import db_manager, transactional, stack_related, resolve_related
from ...core.exceptions import DuplicateEntityError
from ...models.components import Word, Character
from ...models.system_data import Tag, Source
from ...models.containers import Language
from ...schemas.components import WordDict
from ...utils import enrich_word, get_language_by_iso2t, stack_lists
from ..system_data import ScoreService

score_service = ScoreService()

logger = logging.getLogger(__name__)

class WordService:
    @transactional
    def get_all(self, session: Optional[Session] = None) -> list[Word]:
        return db_manager.find_all(model_class=Word, session=session)

    @transactional
    def get_by_id(self, word_id: str, session: Optional[Session] = None) -> Word | None:
        return db_manager.find_by_attr(
            model_class=Word,
            attr_values={"id": word_id},
            session=session,
        )

    @transactional
    def get_by_word(
        self,
        word: str,
        language_id: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> Word | None:
        filters = {"word": word}
        if language_id:
            filters["language_id"] = language_id
        return db_manager.find_by_attr(
            model_class=Word,
            attr_values=filters,
            session=session,
        )

    @transactional
    def create(
        self,
        data: WordDict,
        session: Optional[Session] = None,
        on_conflict: Optional[str] = None,
    ) -> Word | None:
        """Create a new word.

        Args:
            on_conflict: How to resolve an existing word for this language:
                None (default) raises DuplicateEntityError so the caller can
                ask the user; "keep" returns the existing row unchanged;
                "overwrite" recomputes it from `data` + fresh enrichment,
                ignoring the existing value entirely; "merge" fills only
                what's missing, preferring `data` over the existing value
                over enrichment (the prior silent-upsert behavior).
        """
        if existing := self.get_by_word(data.word, language_id=data.language_id, session=session):
            if on_conflict is None:
                raise DuplicateEntityError(
                    entity_type="word",
                    existing=existing.to_dict(include_relations=False),
                    incoming=data.model_dump(exclude_none=True),
                )
            if on_conflict == "keep":
                logger.info(f"Word already exists: {data.word} with ID: {existing.id}; keeping existing")
                return existing
            if on_conflict not in ("overwrite", "merge"):
                raise ValueError(f"Invalid on_conflict value: {on_conflict}")

            logger.info(f"Word already exists: {data.word} with ID: {existing.id}; resolving as {on_conflict}")
            return self.update(
                word_id=existing.id, data=data, session=session,
                force=(on_conflict == "overwrite"), resolving_conflict=True,
            )

        language = db_manager.find_by_attr(model_class=Language, attr_values={"id": data.language_id}, session=session)

        target_language_info = get_language_by_iso2t(language.target_iso639_2t) if language else None
        target_iso1 = target_language_info.iso1 if target_language_info else None
        target_spacy_model = target_language_info.spacy_model if target_language_info else None

        source_iso1 = get_language_by_iso2t(language.source_iso639_2t).iso1 if language else None

        enriched_data = enrich_word(word_text=data.word, target_iso1=target_iso1, source_iso1=source_iso1, target_spacy_model=target_spacy_model)

        characters: dict[str, Character] = {}

        if len(enriched_data["characters"]) > 0:
            logger.debug(f"Enriched characters for word '{data.word}': {enriched_data['characters']}")
            from .character import CharacterService
            from ...schemas.components import CharacterDict
            character_service = CharacterService()
            for character in enriched_data["characters"]:
                # merge: auto-derived characters are expected to recur across many
                # words, so silently reuse the existing row rather than asking the
                # user about a conflict they didn't initiate.
                created_character = character_service.create(
                    data=CharacterDict(
                        character=character,
                        phonetic="",
                        language_id=data.language_id
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_character.id not in characters:
                    characters[created_character.id] = created_character

        word = Word(
            id=db_manager.generate_new_id(model_class=Word, session=session),
            **data.model_dump(
                exclude={'id', 'word', 'phonetic', 'translation', 'word_type', 'word_gender', 'tags', 'sources'},
                exclude_none=True,
            ),
            word=data.word,
            phonetic=data.phonetic if (data.phonetic is not None and data.phonetic != "") else enriched_data["phonetic"],
            translation=data.translation if (data.translation is not None and data.translation != "") else enriched_data["translation"],
            word_type=data.word_type if (data.word_type is not None and data.word_type != "") else enriched_data["word_type"],
            word_gender=data.word_gender if (data.word_gender is not None and data.word_gender != "") else enriched_data["word_gender"],
            tags=session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources=session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else [],
            characters=list(characters.values())
        )
        return db_manager.insert(obj=word, session=session, commit=False)

    @transactional
    def update(
        self,
        word_id: str,
        data: WordDict,
        session: Optional[Session] = None,
        force: bool = False,
        resolving_conflict: bool = False,
    ) -> Word | None:
        """Update an existing word.

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
        existing: Word = self.get_by_id(word_id, session=session)
        if not existing:
            logger.warning(f"Word not found: {word_id}")
            return None

        update_data = data.model_dump(exclude={'id', 'language_id', 'difficulty', 'status', 'score', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)

        if update_data['word'] != existing.word and (existing_word := self.get_by_word(update_data['word'], language_id=existing.language_id, session=session)) and existing_word.id != word_id:
            logger.warning(f"Word with value '{update_data['word']}' already exists.")
            raise ValueError(f"Word with value '{update_data['word']}' already exists.")

        if data.word != existing.word:
            language = db_manager.find_by_attr(model_class=Language, attr_values={"id": existing.language_id}, session=session)

            target_language_info = get_language_by_iso2t(language.target_iso639_2t) if language else None
            target_iso1 = target_language_info.iso1 if target_language_info else None
            target_spacy_model = target_language_info.spacy_model if target_language_info else None

            source_iso1 = get_language_by_iso2t(language.source_iso639_2t).iso1 if language else None

            enriched_data = enrich_word(word_text=data.word, target_iso1=target_iso1, source_iso1=source_iso1, target_spacy_model=target_spacy_model)
        else:
            # word text unchanged — skip re-enrichment (translation/character
            # derivation), it's a slow synchronous NMT call and there's
            # nothing new to derive.
            enriched_data = {"characters": []}

        characters: dict[str, Character] = {
            c.id: session.merge(c) for c in existing.characters
        }
        if len(enriched_data["characters"]) > 0:
            logger.debug(f"Enriched characters for word '{data.word}': {enriched_data['characters']}")
            from .character import CharacterService
            from ...schemas.components import CharacterDict
            character_service = CharacterService()

            for character in enriched_data["characters"]:
                # merge: see the equivalent comment in create() above.
                created_character = character_service.create(
                    data=CharacterDict(
                        language_id=existing.language_id,
                        character=character,
                        phonetic=""
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_character.id not in characters:
                    characters[created_character.id] = created_character

        def resolve(field: str, existing_val):
            provided = update_data.get(field)
            if provided is not None and (force or provided != ""):
                return provided
            if force:
                return enriched_data.get(field)
            return existing_val if existing_val is not None and existing_val != "" else enriched_data.get(field)

        existing.word = update_data.get('word', existing.word)
        existing.phonetic = resolve('phonetic', existing.phonetic)
        existing.translation = resolve('translation', existing.translation)
        existing.word_type = resolve('word_type', existing.word_type)
        existing.word_gender = resolve('word_gender', existing.word_gender)
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
        existing.characters = list(characters.values())

        return db_manager.modify(existing, session=session, commit=False)

    @transactional
    def delete(self, word_id: str, session: Optional[Session] = None) -> bool:
        existing = self.get_by_id(word_id, session=session)
        if not existing:
            logger.warning(f"Word not found: {word_id}")
            return False
        return db_manager.delete(existing, session=session, commit=False)

    @transactional
    def update_score(self, word_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> "Score | None":
        word = self.get_by_id(word_id, session=session)
        if not word:
            logger.warning(f"Word not found: {word_id}")
            return None

        features = [
            *word.vocabulary,
            *word.calligraphy,
            *word.grammar,
        ]

        feature_ids = [f.id for f in features]
        score_map = score_service.get_many(user_id, feature_ids, session=session)
        if feature_ids:
            total_score = sum(score_map[fid].score if fid in score_map else 0.0 for fid in feature_ids)
            total_difficulty = sum(score_map[fid].difficulty if fid in score_map else 0.5 for fid in feature_ids)
            word_score = total_score / len(feature_ids)
            word_difficulty = total_difficulty / len(feature_ids)
        else:
            logger.warning(f"No features found for word: {word_id}")
            word_score = 0.0
            word_difficulty = 0.5

        result = score_service.set(user_id, word_id, word_score, word_difficulty, session=session)
        if result:
            logger.info(f"Updated WordComponent {word_id} score to {result.score} and difficulty to {result.difficulty}")

        return result