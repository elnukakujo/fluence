import logging
import os
import time
from pathlib import Path
from tqdm import tqdm
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask import Flask

from ..core.database import db_manager
from ..models import Vocabulary, Grammar, Calligraphy, Exercise, Character, Word, Passage

logger = logging.getLogger(__name__)

# Files younger than this are skipped even if unreferenced: a freshly-uploaded
# file may not be linked to its DB record yet (upload-then-create is two requests).
MEDIA_GRACE_PERIOD_SECONDS = 15 * 60

def register_media_cleanup_tasks(scheduler: BackgroundScheduler, app: Flask):
    """
    Register media cleanup scheduled tasks.
    Uses interval-based scheduling since app doesn't run 24/7.

    Args:
        scheduler: APScheduler instance
        app: Flask app instance for accessing config
    """
    cleanup_interval = app.config.get('MEDIA_CLEANUP_INTERVAL_MINUTES', 60)

    # Run media cleanup immediately on startup
    scheduler.add_job(
        func=cleanup_orphaned_media,
        id='cleanup_orphaned_media_startup',
        name='Clean up orphaned media files (startup)',
        replace_existing=True,
        args=[app]
    )

    # Run temporary file cleanup immediately on startup
    scheduler.add_job(
        func=cleanup_temporary_files,
        id='cleanup_temporary_files_startup',
        name='Clean up temporary files (startup)',
        replace_existing=True,
        args=[app]
    )

    # Interval-based media cleanup
    scheduler.add_job(
        func=cleanup_orphaned_media,
        trigger=IntervalTrigger(minutes=cleanup_interval),
        id='cleanup_orphaned_media',
        name=f'Clean up orphaned media files (every {cleanup_interval} min)',
        replace_existing=True,
        args=[app]
    )

    logger.info(f"✅ Scheduled job: cleanup_orphaned_media (every {cleanup_interval} minutes)")


def cleanup_orphaned_media(app: Flask):
    """
    Background task to remove media files no longer referenced by any DB record.
    """
    logger.info("🔄 Starting media cleanup task: cleanup_orphaned_media")

    with app.app_context():
        try:
            media_root = Path(app.config['MEDIA_ROOT'])

            # Collect all paths currently referenced in the DB
            referenced: set[str] = set()
            for model_class in [Vocabulary, Grammar, Calligraphy, Exercise, Character, Word, Passage]:
                for record in db_manager.find_all(model_class, load_relationships=False):
                    for col in ["image_files", "audio_files"]:
                        for path_str in (getattr(record, col, None) or []):
                            if isinstance(path_str, str):
                                referenced.add(str((media_root / path_str.lstrip("/").removeprefix("media/").removeprefix("media_dev/").removeprefix("media_test/")).resolve()))

            scanned = orphaned = errors = 0

            logger.info(f"🔍 Referenced paths in DB: {len(referenced)}")

            for subdir in ["images", "audio"]:
                target = media_root / subdir
                if not target.is_dir():
                    logger.warning(f"⚠️  Media sub-directory not found: {target}")
                    continue

                files = [Path(e.path) for e in os.scandir(target) if e.is_file()]
                logger.info(f"🔍 Scanning {len(files)} files in {target}")

                for path in tqdm(files, desc=f"Scanning {subdir}"):
                    scanned += 1
                    if str(path.resolve()) in referenced:
                        continue
                    if time.time() - path.stat().st_mtime < MEDIA_GRACE_PERIOD_SECONDS:
                        continue

                    orphaned += 1
                    try:
                        path.unlink()
                        logger.info(f"✅ Deleted orphaned file: {path.name}")
                    except Exception as e:
                        errors += 1
                        logger.error(f"❌ Failed to handle orphaned file {path.name}: {e}")

            logger.info(f"✅ Media cleanup task completed: {scanned} scanned, {orphaned} orphaned, {errors} errors")

        except Exception as e:
            logger.error(f"❌ Media cleanup task failed: {e}", exc_info=True)

def cleanup_temporary_files(app: Flask):
    """
    Background task to remove temporary files older than a certain threshold.
    This can be scheduled to run periodically if needed.
    """
    logger.info("🔄Starting temporary file cleanup task")
    with app.app_context():
        try:
            temp_dir = Path(app.config['MEDIA_ROOT']) / 'temp'
            if not temp_dir.is_dir():
                logger.warning(f"⚠️ Temporary directory not found: {temp_dir}")
                return

            for file in tqdm(temp_dir.iterdir(), desc="Deleting temporary files"):
                if file.is_file() and time.time() - file.stat().st_mtime >= MEDIA_GRACE_PERIOD_SECONDS:
                    try:
                        file.unlink()
                        logger.info(f"✅ Deleted temporary file: {file.name}")
                    except Exception as e:
                        logger.error(f"❌ Failed to delete temporary file {file.name}: {e}")
        except Exception as e:
            logger.error(f"❌ Temporary file cleanup task failed: {e}", exc_info=True)