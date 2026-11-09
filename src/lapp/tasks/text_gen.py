import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask import Flask
from sqlalchemy import exists
from tqdm import tqdm

from ..core.database import db_manager
from ..models import Grammar, Vocabulary, Calligraphy, Language
from ..models.base import (
    calligraphy_example_word_link,
    calligraphy_example_sentence_link,
    vocabulary_example_sentence_link,
    grammar_example_sentence_link,
    grammar_example_word_link,
)
from ..schemas import GrammarDict, CalligraphyDict, VocabularyDict
from ..services import TextGeneratorService, GrammarService, VocabularyService, CalligraphyService
from ..services.system_data import UserPreferencesService
from ..utils.llm_providers import resolve_api
from ..utils.passage import is_passage

logger = logging.getLogger(__name__)

def register_text_gen_tasks(scheduler: BackgroundScheduler, app: Flask):
    """
    Register Text Generation-related scheduled tasks.
    Uses interval-based scheduling since app doesn't run 24/7.
    
    Args:
        scheduler: APScheduler instance
        app: Flask app instance for accessing config
    """
    # Get Text Generation interval from config (default: 120 minutes = 2 hours)
    text_gen_interval = app.config.get('TEXT_GEN_INTERVAL_MINUTES', 120)
    
    # Run Text Generation immediately on startup (skip with LAPP_SKIP_STARTUP_TASKS=1,
    # e.g. during dev when the app gets restarted often and this is CPU-heavy)
    if os.environ.get('LAPP_SKIP_STARTUP_TASKS', '').lower() not in ('1', 'true', 'yes'):
        scheduler.add_job(
            func=generate_missing_texts,
            id='generate_missing_texts_startup',
            name='Generate missing texts (startup)',
            replace_existing=True,
            args=[app]
        )

    # Interval-based Text Generation
    scheduler.add_job(
        func=generate_missing_texts,
        trigger=IntervalTrigger(minutes=text_gen_interval),
        id='generate_missing_texts',
        name=f'Generate missing texts (every {text_gen_interval} min)',
        replace_existing=True,
        args=[app]
    )

    logger.info(f"✅ Scheduled job: generate_missing_texts (every {text_gen_interval} minutes)")

def generate_missing_texts(app: Flask):
    """
    Background task to generate learnable sentences for Grammars.
    """
    logger.info("🔄 Starting Text Generation task: generate_missing_texts")
    session = db_manager.get_session()
    
    with app.app_context():
        try:
            # Initialize services
            text_gen_service = TextGeneratorService()
            grammar_service = GrammarService()
            vocabulary_service = VocabularyService()
            calligraphy_service = CalligraphyService()
            user_preferences_service = UserPreferencesService()
            ai_gen_by_user: dict[str, tuple[dict[str, bool], dict]] = {}

            calligraphies_without_examples: list[Calligraphy] = (
                session.query(Calligraphy)
                .filter(
                    ~exists().where(calligraphy_example_word_link.c.calligraphy_id == Calligraphy.id)
                    & ~exists().where(calligraphy_example_sentence_link.c.calligraphy_id == Calligraphy.id)
                )
                .all()
            )

            vocabularies_without_examples: list[Vocabulary] = (
                session.query(Vocabulary)
                .filter(
                    ~exists().where(vocabulary_example_sentence_link.c.vocabulary_id == Vocabulary.id)
                )
                .all()
            )

            grammars_without_examples: list[Grammar] = (
                session.query(Grammar)
                .filter(
                    ~exists().where(grammar_example_sentence_link.c.grammar_id == Grammar.id)
                    & ~exists().where(grammar_example_word_link.c.grammar_id == Grammar.id)
                )
                .all()
            )

            features_without_texts = calligraphies_without_examples + vocabularies_without_examples + grammars_without_examples
            
            total_features = len(features_without_texts)
            
            if total_features == 0:
                logger.info("✅ No feature need text generation")
                return
            
            logger.info(f"📋 Found {total_features} features without texts:")
            logger.info(f"   - {len(calligraphies_without_examples)} Calligraphies without example words")
            logger.info(f"   - {len(vocabularies_without_examples)} Vocabularies without example sentences")
            logger.info(f"   - {len(grammars_without_examples)} Grammars without example sentences")
            
            success_count = 0
            error_count = 0
            
            progress = tqdm(features_without_texts, desc="Generating missing texts")
            for feature in progress:
                progress.set_postfix_str(f"{type(feature).__name__} {feature.id}")
                language: Language = db_manager.find_by_pk(Language(id=feature.lesson.language_id), session=session)
                lang_codes = f"{language.source_iso639_2t}->{language.target_iso639_2t}"

                if language.user_id not in ai_gen_by_user:
                    prefs = user_preferences_service.get_by_user_id(language.user_id, session=session)
                    flags = {
                        "learnable_sentence": prefs is None or prefs.ai_learnable_sentence_enabled is not False,
                        "example_sentence": prefs is None or prefs.ai_example_sentence_enabled is not False,
                        "example_word": prefs is None or prefs.ai_example_word_enabled is not False,
                    }
                    api = resolve_api(prefs, "text_gen") if prefs else None
                    ai_gen_by_user[language.user_id] = (flags, api)
                flags, api = ai_gen_by_user[language.user_id]
                if not api or not api["base_url"]:
                    progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [no text-gen api configured for user]")
                    continue

                logger.info(f"Generating text for feature ID {feature.id} with language {language.source_iso639_2t} -> {language.target_iso639_2t}")
                try:
                    # Generate audio using TTS service
                    if isinstance(feature, Calligraphy):
                        if not flags["example_word"]:
                            progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [ai example word gen disabled for user]")
                            continue
                        text = feature.character.character
                        progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [{lang_codes}]: {text[:40]!r}")
                        generated_text = text_gen_service.generate_example_word(
                            text,
                            source_lang_code=language.source_iso639_2t,
                            target_lang_code=language.target_iso639_2t,
                            api=api,
                        )
                    elif isinstance(feature, Vocabulary):
                        if not flags["example_sentence"]:
                            progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [ai example sentence gen disabled for user]")
                            continue
                        text = feature.word.word
                        if is_passage(text, feature.word.word_type):         # the entry is its own example sentence
                            progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [passage: no example]")
                            continue
                        progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [{lang_codes}]: {text[:40]!r}")
                        generated_text = text_gen_service.generate_example_sentence(
                            text,
                            source_lang_code=language.source_iso639_2t,
                            target_lang_code=language.target_iso639_2t,
                            api=api,
                        )
                    elif isinstance(feature, Grammar):
                        if not flags["learnable_sentence"]:
                            progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [ai learnable sentence gen disabled for user]")
                            continue
                        text = f" #{feature.title}\n\n{feature.explanation}"
                        progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [{lang_codes}]: {text[:40]!r}")
                        generated_text = text_gen_service.generate_learnable_sentence(
                            text,
                            source_lang_code=language.source_iso639_2t,
                            target_lang_code=language.target_iso639_2t,
                            api=api,
                        )
                    else:
                        logger.warning(f"⚠️  Unknown feature type for ID {feature.id}, skipping")
                        continue

                    progress.set_postfix_str(f"{type(feature).__name__} {feature.id} [{lang_codes}]: {text[:40]!r} -> {(generated_text or '')[:40]!r}")

                    if generated_text is None or not generated_text.strip():
                        logger.error(f"❌ Failed to generate text for Feature ID {feature.id}: empty or null result")
                        error_count += 1
                        continue
                    
                    if isinstance(feature, Calligraphy):
                        calligraphy_service.update(
                            calligraphy_id=feature.id,
                            data=CalligraphyDict(
                                lesson_id=feature.lesson_id,
                                character=feature.character.to_dict(include_relations=False),
                                example_words=[{"word": generated_text, "translation": "", "type": ""}]
                            ),
                            session=session
                        )
                    elif isinstance(feature, Vocabulary):
                        vocabulary_service.update(
                            voc_id=feature.id,
                            data=VocabularyDict(
                                lesson_id=feature.lesson_id,
                                word=feature.word.to_dict(include_relations=False),
                                example_sentences=[
                                    {"text": generated_text, "translation": ""}
                                ]
                            ),
                            session=session
                        )
                    elif isinstance(feature, Grammar):
                        grammar_data = feature.to_dict(include_relations=False)
                        grammar_data.pop('id', None)
                        grammar_data.pop('score', None)
                        grammar_data.pop('difficulty', None)
                        grammar_data.pop('status', None)
                        grammar_data.pop('created_at', None)
                        grammar_data.pop('last_seen_at', None)

                        grammar_data["example_sentences"] = [{"text": generated_text, "translation": ""}]

                        grammar_service.update(
                            grammar_id=feature.id,
                            data=GrammarDict(**grammar_data),
                            session=session
                        )
                    
                    # Each service.update() above was called with session=session and
                    # commit=False internally (per the @transactional contract) — this
                    # caller owns the commit. Without it, session.close() below would
                    # roll everything back and the backlog would never actually shrink.
                    session.commit()
                    success_count += 1
                    logger.info(f"✅ Generated text for Feature ID {feature.id}: '{generated_text}'")

                except Exception as e:
                    session.rollback()
                    error_count += 1
                    logger.error(f"❌ Failed to generate text for Feature ID {feature.id}: {e}", exc_info=True)
                    continue
            
            logger.info(f"✅ Text Generation task completed: {success_count} texts generated, {error_count} errors")
        except Exception as e:
            logger.error(f"❌ Text Generation task failed: {e}", exc_info=True)
        finally:
            session.close()