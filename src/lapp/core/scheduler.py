import logging
import os
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask

logger = logging.getLogger(__name__)


class AppScheduler:
    """
    Centralized scheduler for all background tasks.
    Manages APScheduler instance and task registration.
    Uses interval-based scheduling for apps that don't run 24/7.
    """
    
    def __init__(self):
        # 'ingest' has ONE worker: a 150-page scan used ~1.6 GB, so uploads must never run in parallel.
        self.scheduler = BackgroundScheduler(executors={
            "default": ThreadPoolExecutor(10),
            "ingest": ThreadPoolExecutor(1),
        })
        self._running = False
    
    def init_app(self, app: Flask):
        """
        Initialize scheduler with Flask app.
        
        Args:
            app: Flask application instance
        """
        self.app = app
        
        # Register all scheduled tasks
        self._register_tasks()
        
        from ..services.ingestion.jobs import IngestionJobService
        interrupted = IngestionJobService().fail_interrupted()
        if interrupted:
            logger.warning("Marked %s interrupted ingestion job(s) as failed", interrupted)

        logger.info("✅ AppScheduler initialized with Flask app")
    
    def _register_tasks(self):
        """Register all scheduled tasks from different modules."""
        # Import task registration functions
        from ..tasks import register_backup_tasks, register_text_gen_tasks, register_tts_tasks, register_media_cleanup_tasks
        
        # Register tasks from each module
        register_backup_tasks(self.scheduler, self.app)
        register_text_gen_tasks(self.scheduler, self.app)
        register_tts_tasks(self.scheduler, self.app)
        register_media_cleanup_tasks(self.scheduler, self.app)
        
        logger.info("✅ All scheduled tasks registered")
    
    def start(self):
        """Start the scheduler."""
        if not self._running:
            self.scheduler.start()
            self._running = True
            logger.info("✅ AppScheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler without waiting for in-flight jobs (a stuck
        generation call must not block process exit on Ctrl+C)."""
        if self._running:
            self.scheduler.shutdown(wait=False)
            self._running = False
            logger.info("🛑 AppScheduler stopped")
    
    def schedule_ingestion(self, app: Flask, job_id: str) -> None:
        """Queue a document-ingestion job on the single-worker 'ingest' executor."""
        from ..services.ingestion.jobs import run_ingestion_job
        self.scheduler.add_job(run_ingestion_job, args=[app, job_id], executor="ingest",
                               id=f"ingest-{job_id}", misfire_grace_time=None)

    def is_running(self) -> bool:
        """Check if scheduler is running."""
        return self._running
    
    def get_jobs(self):
        """Get all scheduled jobs."""
        return self.scheduler.get_jobs()


# Global scheduler instance
app_scheduler = AppScheduler()


def init_scheduler(app: Flask) -> AppScheduler:
    """
    Initialize scheduler with Flask app.
    
    Args:
        app: Flask application instance
    
    Returns:
        AppScheduler instance
    """
    # Detect the real process (not the reloader)
    is_main_process = (
        not app.debug
        or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    )
    
    if is_main_process and not app.config.get('TESTING'):
        app_scheduler.init_app(app)
        app_scheduler.start()
        
        # Register cleanup on shutdown
        import atexit
        atexit.register(app_scheduler.shutdown)
        
        logger.info("✅ Scheduler initialized and started")
    else:
        logger.info("⏭️ Skipping scheduler initialization (reloader or testing)")
    
    return app_scheduler