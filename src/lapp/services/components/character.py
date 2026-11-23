import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ...schemas.components import CharacterDict
from ...models.components import Character, RadicalCatalogue
from ...models.containers import Language
from ...core.database import db_manager, transactional, stack_related, resolve_related
from ...core.exceptions import DuplicateEntityError
from ...models.system_data import Tag, Source
from ...utils.strokes import list_radicals
from ...utils import enrich_character, get_language_by_iso2t, stack_lists
from ..system_data import ScoreService
from ..system_data.score_cascade import refresh

score_service = ScoreService()
RADICAL_LANGUAGES = {"zho", "jpn"}      # the languages with a radical dictionary (DM-50: Korean has none)


def has_characters(iso2: str | None) -> bool:
    """DM-50: read from the language registry (Korean has no Character/radical element type)."""
    from ...core.languages import language_for_iso2
    supported = language_for_iso2(iso2)
    return supported.has_characters if supported else True      # unknown (legacy) courses keep working


def _clean_readings(readings: list) -> list:
    """Shape only: [{kind: str, value: non-empty str, primary: bool}], at most one primary. `kind` is free (TODO(owner): kinds per language)."""
    out = []
    for r in readings:
        if not (isinstance(r, dict) and isinstance(r.get("kind"), str) and r["kind"] and isinstance(r.get("value"), str) and r["value"]):
            raise ValueError("a reading needs a kind and a value")
        out.append({"kind": r["kind"], "value": r["value"], "primary": bool(r.get("primary", False))})
    if sum(r["primary"] for r in out) > 1:
        raise ValueError("at most one primary reading")
    return out


class CharacterService:
    @staticmethod
    def _check_links(char_id: Optional[str], language_id: str, key_radical_id: Optional[str], components: list, session: Session) -> None:
        """Key radical and components: same language, not the character itself, no cycles (DM-48)."""
        refs = [*([key_radical_id] if key_radical_id else []), *components]
        if not refs:
            return
        if char_id and char_id in refs:
            raise ValueError("a character cannot be its own radical or component")
        rows = {c.id: c for c in session.query(Character).filter(Character.language_id == language_id)}
        if any(r not in rows for r in refs):
            raise ValueError("radical and components must be characters of the same language")
        seen, stack = set(), list(refs)               # does any reference lead back to char_id?
        while char_id and stack:
            cur = stack.pop()
            if cur == char_id:
                raise ValueError("radical/component cycle")
            if cur not in seen:
                seen.add(cur)
                c = rows[cur]
                stack += [*([c.key_radical_id] if c.key_radical_id else []), *(c.components or [])]

    def _glyph_to_id(self, language_id: str, glyph: str, session: Session) -> str:
        """The Character of this language written `glyph`; created (like any character, enriched) when the language has none."""
        existing = self.get_by_character(glyph, language_id=language_id, session=session)
        return (existing or self.create(CharacterDict(language_id=language_id, character=glyph), session=session, on_conflict="keep")).id

    def _links_from_glyphs(self, char_id: Optional[str], language_id: str, own_glyph: str, radical: Optional[str],
                           component_glyphs: Optional[list[str]], session: Session) -> tuple[Optional[str], Optional[list[str]]]:
        """(key_radical_id, components) from what the learner typed in the form; None = not given, leave as is.
        A glyph equal to the character itself is not linked (it stays as the free text)."""
        key = components = None
        if radical is not None:
            r = radical.strip()
            key = "" if not r else (None if r == own_glyph else self._glyph_to_id(language_id, r, session))
        if component_glyphs is not None:
            glyphs = [g for g in dict.fromkeys(ch for part in component_glyphs for ch in part.strip() if not ch.isspace()) if g != own_glyph]
            components = [self._glyph_to_id(language_id, g, session) for g in glyphs]
        return key, components

    @transactional
    def radical_options(self, language_id: str, session: Optional[Session] = None) -> list[dict]:
        """The radicals offered by the pickers of the character form: the dictionary's radicals plus the catalogue rows of the language,
        each with the id of the Character the learner already has for it (None = it would be created on save). zh/ja only."""
        language = session.get(Language, language_id)
        if not language or language.target_iso639_2t not in RADICAL_LANGUAGES:
            return []
        have = {c.character: c.id for c in session.query(Character).filter(Character.language_id == language_id)}
        entries = {r["character"]: r["meaning"] for r in list_radicals()}
        for row in session.query(RadicalCatalogue).filter(RadicalCatalogue.language_iso == language.target_iso639_2t):
            entries[row.character] = row.meaning or entries.get(row.character, "")
        return [{"character": g, "meaning": m, "id": have.get(g)} for g, m in entries.items()]

    @transactional
    def used_in(self, char_id: str, language_id: str, session: Optional[Session] = None) -> list[str]:
        """Ids of the characters that use this one as key radical or component."""
        return [c.id for c in session.query(Character).filter(Character.language_id == language_id).order_by(Character.id)
                if c.key_radical_id == char_id or char_id in (c.components or [])]

    @transactional
    def list_for_language(self, language_id: str, radicals: bool = False, session: Optional[Session] = None) -> list[Character]:
        chars = session.query(Character).filter(Character.language_id == language_id).order_by(Character.id).all()
        if not radicals:
            return chars
        used = {r for c in chars for r in [c.key_radical_id, *(c.components or [])] if r}
        return [c for c in chars if c.id in used]

    @transactional
    def copy_radical(self, char_id: str, catalogue_id: int, session: Optional[Session] = None) -> Character | None:
        """Copy a catalogue entry into the character's language as an ordinary Character (reused when it already exists)
        and make it the key radical of `char_id` (DM-49)."""
        target = self.get_by_id(char_id, session=session)
        entry = session.get(RadicalCatalogue, catalogue_id)
        if not target or not entry:
            return None
        radical = self.get_by_character(entry.character, language_id=target.language_id, session=session)
        if not radical:
            radical = self.create(CharacterDict(language_id=target.language_id, character=entry.character, phonetic=entry.phonetic,
                                                meaning=entry.meaning, strokes=entry.strokes), session=session)
        self._check_links(char_id, target.language_id, radical.id, list(target.components or []), session)
        target.key_radical_id = radical.id
        session.flush()
        return radical

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
        autofill: bool = False,
    ) -> Character | None:
        """Create a new character.

        Args:
            autofill: a character the learner (or the AI parser) adds on purpose gets its radical and first-level components
                filled from the decomposition when none was given (linked, missing ones created without autofill). Characters
                derived from a word or passage stay unlinked stubs, so a long text does not create dozens of extra rows.

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
        if language and not has_characters(language.target_iso639_2t):
            raise ValueError("this language has no characters")          # DM-50

        source_iso1 = get_language_by_iso2t(language.source_iso639_2t).iso1 if language else None
        target_iso1 = get_language_by_iso2t(language.target_iso639_2t).iso1 if language else None

        enriched_data = enrich_character(character_text=data.character, target_iso1=target_iso1, source_iso1=source_iso1)
        readings = _clean_readings(data.readings) if data.readings else None
        radical_text, glyphs = data.radical, data.component_glyphs
        if autofill:
            if not (data.radical or data.key_radical_id) and enriched_data.get("radical"):
                radical_text = enriched_data["radical"]
            if glyphs is None and not data.components:
                glyphs = list(enriched_data.get("components") or [])
        key_id, comp_ids = self._links_from_glyphs(None, data.language_id, data.character, radical_text, glyphs, session)
        self._check_links(None, data.language_id, key_id or data.key_radical_id, comp_ids if comp_ids is not None else (data.components or []), session)

        character = Character(
            id=db_manager.generate_new_id(model_class=Character, session=session),
            **{k: v for k, v in data.model_dump(exclude={'id', 'difficulty', 'status', 'score', 'created_at', 'last_seen_at', 'phonetic', 'radical', 'meaning', 'readings', 'components', 'component_glyphs', 'key_radical_id', 'clear_radical'}, exclude_none=True).items()},
            phonetic=data.phonetic if (data.phonetic is not None and data.phonetic != "") else enriched_data["phonetic"],
            radical=data.radical if (data.radical is not None and data.radical != "") else enriched_data["radical"],
            meaning=data.meaning if (data.meaning is not None and data.meaning != "") else enriched_data["meaning"],
            tags = resolve_related(data.tags, Tag, session, anchor=data),
            sources = resolve_related(data.sources, Source, session, anchor=data),
            components=list(comp_ids if comp_ids is not None else (data.components or [])),
            key_radical_id=key_id or data.key_radical_id,
        )
        character.readings = readings if readings is not None else (
            [{"kind": "phonetic", "value": character.phonetic, "primary": True}] if character.phonetic else [])
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
        existing.radical = None if update_data.get('clear_radical') else resolve('radical', existing.radical)
        existing.meaning = resolve('meaning', existing.meaning)
        existing.strokes = update_data.get('strokes', existing.strokes)
        key_id, comp_ids = self._links_from_glyphs(character_id, existing.language_id, existing.character,
                                                   "" if update_data.get('clear_radical') else update_data.get('radical'),
                                                   update_data.get('component_glyphs'), session)
        key_radical = (None if key_id == "" else key_id) if key_id is not None else update_data.get('key_radical_id', existing.key_radical_id)
        components = comp_ids if comp_ids is not None else update_data.get('components', existing.components or [])
        self._check_links(character_id, existing.language_id, key_radical, components, session)
        existing.key_radical_id, existing.components = key_radical, list(components)
        if data.readings is not None:
            existing.readings = _clean_readings(data.readings)
        elif existing.phonetic:     # phonetic and the primary "phonetic" reading stay in step
            others = [r for r in (existing.readings or []) if r.get("kind") != "phonetic"]
            existing.readings = [{"kind": "phonetic", "value": existing.phonetic, "primary": not any(r.get("primary") for r in others)}, *others]
        if resolving_conflict:
            existing.audio_files = stack_lists(existing.audio_files, update_data.get('audio_files'))
            existing.image_files = stack_lists(existing.image_files, update_data.get('image_files'))
            existing.tags = stack_related(existing.tags, data.tags, Tag, session, anchor=existing)
            existing.sources = stack_related(existing.sources, data.sources, Source, session, anchor=existing)
        else:
            existing.audio_files = update_data.get('audio_files', existing.audio_files)
            existing.image_files = update_data.get('image_files', existing.image_files)
            if data.tags is not None:
                existing.tags = resolve_related(data.tags, Tag, session, anchor=existing)
            if data.sources is not None:
                existing.sources = resolve_related(data.sources, Source, session, anchor=existing)

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
        result = refresh(user_id, char_id, feature_ids, session=session)
        if result:
            logger.info(f"Updated CharacterComponent {char_id} score to {result.score} and difficulty to {result.difficulty}")

        return result