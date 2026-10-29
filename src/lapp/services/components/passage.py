from datetime import datetime
import logging
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ...schemas.components import PassageDict
from ...models.components import Passage, Word, Character
from ...models.system_data import Tag, Source
from ...models.containers import Language
from ...core.database import db_manager, transactional, resolve_related
from ...utils import enrich_passage, get_language_by_iso2t
from ..system_data import ScoreService

score_service = ScoreService()


class PassageService:
    @transactional
    def get_all(self, session: Optional[Session] = None) -> list[Passage]:
        """
        Get all passages.

        Args:
            None

        Returns:
            List of Passage objects
        """
        return db_manager.find_all(model_class=Passage, session=session)

    @transactional
    def get_by_id(self, passage_id: str, session: Optional[Session] = None) -> Passage | None:
        """
        Get a passage by its ID.

        Args:
            passage_id: The ID of the passage to retrieve.

        Returns:
            Passage object if found, else None
        """
        return db_manager.find_by_attr(
            model_class=Passage,
            attr_values={'id': passage_id},
            session=session
        )

    @transactional
    def get_by_vocabulary_id(self, vocabulary_id: str, session: Optional[Session] = None) -> list[Passage]:
        """
        Get all passages for a specific vocabulary.

        Args:
            vocabulary_id: The ID of the vocabulary to get passages for.

        Returns:
            List of Passage objects
        """
        return session.query(Passage).filter(Passage.vocabulary.any(id=vocabulary_id)).all()

    @transactional
    def get_by_text(self, text: str, language_id: Optional[str] = None, session: Optional[Session] = None) -> Passage | None:
        """
        Get a passage by its text.

        Args:
            text: The text of the passage to retrieve.

        Returns:
            Passage object if found, else None
        """
        filters = {'text': text}
        if language_id:
            filters['language_id'] = language_id
        return db_manager.find_by_attr(
            model_class=Passage,
            attr_values=filters,
            session=session
        )

    @transactional
    def get_by_grammar_id(self, grammar_id: str, session: Optional[Session] = None) -> list[Passage]:
        """
        Get all passages for a specific grammar.

        Args:
            grammar_id: The ID of the grammar to get passages for.

        Returns:
            List of Passage objects
        """
        return session.query(Passage).filter(Passage.grammar.any(id=grammar_id)).all()

    @transactional
    def create(self, data: PassageDict, session: Optional[Session] = None) -> Passage | None:
        """
        Create a new passage.

        Args:
            data: PassageDict containing passage details.

        Returns:
            Created Passage object if successful, else None
        """
        if existing := self.get_by_text(data.text, language_id=data.language_id, session=session):
            logger.info(f"Passage already exists: {data.text} with ID: {existing.id}")
            existing = self.update(passage_id=existing.id, data=data, session=session)
            existing = session.merge(existing)
            return existing

        language = db_manager.find_by_attr(model_class=Language, attr_values={"id": data.language_id}, session=session)

        target_language_info = get_language_by_iso2t(language.target_iso639_2t) if language else None
        target_iso1 = target_language_info.iso1 if target_language_info else None
        target_spacy_model = target_language_info.spacy_model if target_language_info else None

        source_language_info = get_language_by_iso2t(language.source_iso639_2t) if language else None
        source_iso1 = source_language_info.iso1 if source_language_info else None

        enriched_data = enrich_passage(passage_text=data.text, target_iso1=target_iso1, source_iso1=source_iso1, target_spacy_model=target_spacy_model)

        characters: dict[str, Character] = {}
        if len(enriched_data["characters"]) > 0:
            logger.debug(f"Enriched characters for passage '{data.text}': {enriched_data['characters']}")
            from .character import CharacterService
            from ...schemas.components import CharacterDict
            character_service = CharacterService()

            for character in enriched_data["characters"]:
                # merge: characters/words tokenized out of the full passage text
                # are auxiliary/derived, not the primary thing the user is
                # creating — preserve silent-merge behavior for these.
                created_character = character_service.create(
                    data=CharacterDict(
                        character=character,
                        language_id=data.language_id
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_character.id not in characters:
                    characters[created_character.id] = created_character

        words: dict[str, Word] = {}
        if len(enriched_data["words"]) > 0:
            logger.debug(f"Enriched words for passage '{data.text}': {enriched_data['words']}")
            from .word import WordService
            from ...schemas.components import WordDict
            word_service = WordService()

            for word in enriched_data["words"]:
                created_word = word_service.create(
                    data=WordDict(
                        word=word,
                        language_id=data.language_id
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_word.id not in words:
                    words[created_word.id] = created_word

        passage = Passage(
            id=db_manager.generate_new_id(model_class=Passage, session=session),
            **{k: v for k, v in data.model_dump(exclude={'id','status', 'difficulty', 'score', 'created_at', 'last_seen_at', 'translation', 'tags', 'sources'}, exclude_none=True).items()},
            translation=data.translation if (data.translation is not None and data.translation != "") else enriched_data["translation"],
            tags=session.query(Tag).filter(Tag.id.in_([t.id for t in data.tags])).all() if data.tags else [],
            sources=session.query(Source).filter(Source.id.in_([s.id for s in data.sources])).all() if data.sources else [],
            characters=list(characters.values()),
            words=list(words.values())
        )
        result = db_manager.insert(obj=passage, session=session, commit=False)

        if result:
            logger.info(f"Created new passage with ID: {result.id}")
        else:
            logger.error(f"Failed to create new passage")

        return result

    @transactional
    def update(self, passage_id: str, data: PassageDict, session: Optional[Session] = None) -> Passage | None:
        """
        Update an existing passage.

        Args:
            passage_id: The ID of the passage to update.
            data: PassageDict containing updated passage details.

        Returns:
            Updated Passage object if successful, else None
        """
        existing: Passage = self.get_by_id(passage_id, session=session)

        if not existing:
            logger.warning(f"Passage not found: {passage_id}")
            return None

        update_data = data.model_dump(exclude={'id', 'language_id', 'difficulty', 'status', 'score', 'created_at', 'last_seen_at', 'tags', 'sources'}, exclude_none=True)

        if update_data['text'] != existing.text and (existing_passage := self.get_by_text(update_data['text'], language_id=existing.language_id, session=session)) and existing_passage.id != passage_id:
            logger.warning(f"Passage with value '{update_data['text']}' already exists.")
            raise ValueError(f"Passage with value '{update_data['text']}' already exists.")

        language = db_manager.find_by_attr(model_class=Language, attr_values={"id": existing.language_id}, session=session)

        target_language_info = get_language_by_iso2t(language.target_iso639_2t) if language else None
        target_iso1 = target_language_info.iso1 if target_language_info else None
        target_spacy_model = target_language_info.spacy_model if target_language_info else None

        source_language_info = get_language_by_iso2t(language.source_iso639_2t) if language else None
        source_iso1 = source_language_info.iso1 if source_language_info else None

        enriched_data = enrich_passage(passage_text=data.text, target_iso1=target_iso1, source_iso1=source_iso1, target_spacy_model=target_spacy_model)

        characters: dict[str, Character] = {c.id: session.merge(c) for c in existing.characters}
        if len(enriched_data["characters"]) > 0:
            logger.debug(f"Enriched characters for passage '{data.text}': {enriched_data['characters']}")
            from .character import CharacterService
            from ...schemas.components import CharacterDict
            character_service = CharacterService()

            for character in enriched_data["characters"]:
                # merge: see the equivalent comment in create() above.
                created_character = character_service.create(
                    data=CharacterDict(
                        character=character,
                        language_id=existing.language_id
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_character.id not in characters:
                    characters[created_character.id] = created_character

        words: dict[str, Word] = {w.id: session.merge(w) for w in existing.words}
        if len(enriched_data["words"]) > 0:
            logger.debug(f"Enriched words for passage '{data.text}': {enriched_data['words']}")
            from .word import WordService
            from ...schemas.components import WordDict
            word_service = WordService()

            for word in enriched_data["words"]:
                created_word = word_service.create(
                    data=WordDict(
                        word=word,
                        language_id=existing.language_id
                    ),
                    session=session,
                    on_conflict="merge",
                )
                if created_word.id not in words:
                    words[created_word.id] = created_word

        def resolve(field: str, existing_val):
            provided = update_data.get(field)
            if provided is not None and provided != "":
                return provided
            return existing_val if existing_val is not None and existing_val != "" else enriched_data.get(field)

        existing.text = update_data.get('text', existing.text)
        existing.translation = resolve('translation', existing.translation)
        existing.audio_files = update_data.get('audio_files', existing.audio_files)
        existing.image_files = update_data.get('image_files', existing.image_files)
        existing.words = list(words.values())
        existing.characters = list(characters.values())
        if data.tags is not None:
            existing.tags = resolve_related(data.tags, Tag, session)
        if data.sources is not None:
            existing.sources = resolve_related(data.sources, Source, session)

        result = db_manager.modify(existing, session=session, commit=False)

        if result:
            logger.info(f"Updated passage: {passage_id}")
        else:
            logger.error(f"Failed to update passage: {passage_id}")

        return result

    @transactional
    def delete(self, passage_id: str, session: Optional[Session] = None) -> bool:
        """
        Delete a passage by its ID.

        Args:
            passage_id: The ID of the passage to delete.

        Returns:
            True if deletion was successful, else False
        """
        existing = self.get_by_id(passage_id, session=session)

        if not existing:
            logger.warning(f"Passage not found: {passage_id}")
            return False

        success = db_manager.delete(existing, session=session, commit=False)

        if success:
            logger.info(f"Deleted passage: {passage_id}")
        else:
            logger.error(f"Failed to delete passage: {passage_id}")

        return success

    @transactional
    def update_score(self, passage_id: str, user_id: Optional[str] = None, session: Optional[Session] = None) -> "Score | None":
        passage = self.get_by_id(passage_id, session=session)
        if not passage:
            logger.warning(f"Passage not found: {passage_id}")
            return None

        features = [
            *passage.vocabulary,
            *passage.calligraphy,
            *passage.grammar,
        ]

        feature_ids = [f.id for f in features]
        score_map = score_service.get_many(user_id, feature_ids, session=session)
        if feature_ids:
            total_score = sum(score_map[fid].score if fid in score_map else 0.0 for fid in feature_ids)
            total_difficulty = sum(score_map[fid].difficulty if fid in score_map else 0.5 for fid in feature_ids)
            passage_score = total_score / len(feature_ids)
            passage_difficulty = total_difficulty / len(feature_ids)
        else:
            logger.warning(f"No features found for passage: {passage_id}")
            passage_score = 0.0
            passage_difficulty = 0.5

        result = score_service.set(user_id, passage_id, passage_score, passage_difficulty, session=session)
        if result:
            logger.info(f"Updated PassageComponent {passage_id} score to {result.score} and difficulty to {result.difficulty}")

        return result