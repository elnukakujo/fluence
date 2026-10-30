import logging
import time
from collections import deque
from logging import Formatter, StreamHandler

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flasgger import Swagger

from ..core.database import init_db
from config import config

logger = logging.getLogger(__name__)

# In-memory ring buffer of recent log lines, served to admins via /api/logs.
# ponytail: resets on process restart and caps at LOG_BUFFER_SIZE lines; add a
# rotating FileHandler if logs must survive restarts.
LOG_BUFFER_SIZE = 500
_log_buffer: deque = deque(maxlen=LOG_BUFFER_SIZE)


class _RingBufferHandler(logging.Handler):
    """Append formatted log records to the module-level ring buffer."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_buffer.append(self.format(record))
        except Exception:  # pragma: no cover - never let logging break the app
            pass

def create_app(config_name: str = 'default') -> Flask:
    """
    Application factory pattern for Flask.
    
    Args:
        config_name: Configuration to use ('development', 'testing', 'production')
    
    Returns:
        Configured Flask application
    """
    app = Flask(__name__)

    # Don't 308-redirect on trailing-slash mismatches. Behind the Next.js rewrite
    # (which strips trailing slashes), Flask's default strict_slashes redirect leaks
    # the internal host (http://backend:5050) into the Location header, which browsers
    # then reject as mixed content. Accept both /x and /x/ instead.
    app.url_map.strict_slashes = False

    # Load configuration
    app.config.from_object(config[config_name])

    # Configure logging
    configure_logging(app)

    logger.info(f"📁 MEDIA_ROOT={app.config.get('MEDIA_ROOT')!r} BACKUP_ROOT={app.config.get('BACKUP_ROOT')!r}")
    
    # Enable CORS for frontend
    _frontend_origins = [o.strip() for o in app.config.get('FRONTEND_ORIGIN', '').split(',') if o.strip()]
    CORS(app, resources={
        r"/api/*": {"origins": _frontend_origins},
        r"/media/*": {"origins": "*"},
        r"/media_dev/*": {"origins": "*"},
        r"/media_test/*": {"origins": "*"}
    }, supports_credentials=True)

    # Register blueprints
    register_blueprints(app)

    # Resolve the session cookie on every request
    from ..core.auth import init_auth
    init_auth(app)

    # Log every request so activity (reviews, edits, …) shows up in /api/logs
    register_request_logging(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register CLI commands
    register_commands(app)

    # Register health check endpoint
    register_health_check(app)

    # Register logs endpoint
    register_logs_endpoint(app)

    # Initialize extensions
    initialize_extensions(app)
    
    logger.info(f"🚀 Flask app created with config: {config_name}")
    
    Swagger(app)
    
    return app


def configure_logging(app: Flask) -> None:
    """Configure application logging: one format for stdout + the ring buffer."""
    log_level = logging.DEBUG if app.config.get('DEBUG') else logging.INFO

    fmt = Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        '%Y-%m-%d %H:%M:%S',
    )

    root = logging.getLogger()
    root.setLevel(log_level)

    stream = StreamHandler()
    stream.setFormatter(fmt)
    root.addHandler(stream)

    ring = _RingBufferHandler()
    ring.setFormatter(fmt)
    root.addHandler(ring)

    # Quiet noisy third-party loggers so the logs users copy stay readable.
    for name in (
        'sqlalchemy.engine',
        'sqlalchemy.pool',
        'urllib3',
        'urllib3.connectionpool',
        'httpx',
        'httpcore',
        'transformers',
        'spacy',
        'torch',
        'werkzeug',
        'apscheduler',
    ):
        logging.getLogger(name).setLevel(logging.WARNING)


def initialize_extensions(app: Flask) -> None:
    """Initialize Flask extensions and database."""
    # Initialize database
    init_db(app)

    # Attach the backup manager so CLI commands and /api/backup routes can use it
    from pathlib import Path
    from ..services.backup import BackupService
    app.backup_manager = BackupService(
        database_url=app.config['SQLALCHEMY_DATABASE_URI'],
        schema=app.config['DB_SCHEMA'],
        backup_dir=Path(app.config['BACKUP_ROOT']),
        max_backups=app.config['MAX_BACKUPS']
    )

    # Initialize centralized scheduler (handles ALL background tasks including backups)
    from ..core.scheduler import init_scheduler
    scheduler = init_scheduler(app)
    app.scheduler = scheduler


def register_blueprints(app: Flask) -> None:
    """Register all API blueprints."""
    
    from ..api.routes import (
        language_bp,
        lesson_bp,
        vocabulary_bp,
        calligraphy_bp,
        grammar_bp,
        exercise_bp,
        media_bp,
        backup_bp,
        evaluate_bp,
        tag_bp,
        source_bp,
        user_bp,
        user_preferences_bp,
        search_bp,
        word_bp,
        character_bp,
        passage_bp,
        daily_stats_bp,
        commitment_log_bp,
        review_bp,
        auth_bp,
        collaboration_bp,
        ingestion_bp,
    )

    # Register blueprints
    blueprints = [
        language_bp,
        lesson_bp,
        vocabulary_bp,
        calligraphy_bp,
        grammar_bp,
        exercise_bp,
        media_bp,
        backup_bp,
        evaluate_bp,
        tag_bp,
        source_bp,
        user_bp,
        user_preferences_bp,
        search_bp,
        word_bp,
        character_bp,
        passage_bp,
        daily_stats_bp,
        commitment_log_bp,
        review_bp,
        auth_bp,
        collaboration_bp,
        ingestion_bp,
    ]

    for blueprint in blueprints:
        app.register_blueprint(blueprint)
        logger.info(f"✅ Registered blueprint: {blueprint.name}")


def register_error_handlers(app: Flask) -> None:
    """Register error handlers for common HTTP errors."""
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Not Found',
            'message': 'The requested resource was not found'
        }), 404
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad Request',
            'message': str(error)
        }), 400

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'Forbidden',
            'message': str(error)
        }), 403
    
    @app.errorhandler(409)
    def conflict(error):
        return jsonify({
            'error': 'Conflict',
            'message': str(error)
        }), 409

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        logger.error(f"Unhandled exception: {error}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500


def register_commands(app: Flask) -> None:
    """Register custom CLI commands."""
    
    @app.cli.command()
    def init_db():
        """Initialize the database."""
        from ..core.database import db_manager
        db_manager.create_tables()
        print("✅ Database initialized")
    
    @app.cli.command()
    def backup_now():
        """Create a manual backup."""
        backup_path = app.backup_manager.create_backup()
        if backup_path:
            print(f"✅ Backup created: {backup_path}")
        else:
            print("❌ Backup failed")

    @app.cli.command()
    def restore_backup():
        """Restore from latest backup."""
        success = app.backup_manager.restore_backup()
        if success:
            print("✅ Database restored")
        else:
            print("❌ Restore failed")


# Health check endpoint
def register_health_check(app: Flask) -> None:
    """Register health check endpoint."""

    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'environment': app.config.get('ENV', 'unknown')
        })


def register_logs_endpoint(app: Flask) -> None:
    """Register the admin-only endpoint that serves the buffered log lines."""
    from ..core.auth import admin_required

    @app.route('/api/logs', methods=['GET'])
    @admin_required
    def get_logs():
        return jsonify({'logs': list(_log_buffer)})


def register_request_logging(app: Flask) -> None:
    """Log one line per request so user activity shows up in /api/logs."""

    @app.before_request
    def _start_timer():
        g._request_start = time.perf_counter()

    @app.after_request
    def _log_request(response):
        start = getattr(g, '_request_start', None)
        if start is None:
            return response
        # Health checks are polled constantly — skip them to keep logs readable.
        if request.path == '/health':
            return response
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            f"{request.method} {request.path} {response.status_code} {duration_ms:.0f}ms"
        )
        return response