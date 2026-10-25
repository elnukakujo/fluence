from pathlib import Path
import os

from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_DIR = BASE_DIR / 'media'
BACKUP_DIR = BASE_DIR / 'backups'


def _normalize_database_url(url: str) -> str:
    """Point Postgres URLs at the installed psycopg (v3) driver.

    Also upgrades the legacy "postgres://" scheme some hosts (e.g. Heroku)
    still hand out, which SQLAlchemy 2.x no longer accepts as-is.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _schema_scoped_url(base_url: str, schema: str) -> str:
    """Pin every connection from this URL to one Postgres schema via libpq's
    `options` param, so a single DATABASE_URL (one server) serves all three
    configs isolated into fluence_dev/fluence_test/fluence_prod schemas.
    """
    sep = '&' if '?' in base_url else '?'
    return f"{base_url}{sep}options=-csearch_path%3D{schema}"


_DATABASE_URL = os.environ.get('DATABASE_URL')
if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is required (Postgres only - no SQLite fallback). "
        "e.g. postgresql://fluence:fluence@localhost:5432/fluence"
    )
_BASE_DATABASE_URL = _normalize_database_url(_DATABASE_URL)

class Config:
    """Base configuration for personal use"""
    # Auth
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-secret-change-me')
    # Comma-separated allowed frontend origins (CORS). Defaults cover local dev
    # (Next.js on 3000 or 8080); set to your production domain for deployment.
    FRONTEND_ORIGIN = os.environ.get(
        'FRONTEND_ORIGIN',
        'http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080',
    )

    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Paths
    MEDIA_ROOT = str(BASE_DIR / 'media')
    BACKUP_ROOT = str(BASE_DIR / 'backups')
    
    # Media settings
    MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5MB
    ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'm4a'}
    ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png'}
    
    # Backup settings
    BACKUP_AFTER_ACTIONS = 100  # Create a backup after this many DB mutations
    MAX_BACKUPS = 10  # Keep last 10 backups

    # Media cleanup settings
    MEDIA_CLEANUP_INTERVAL_MINUTES = 60  # Run every 60 minutes while

    # TTS settings
    TTS_INTERVAL_MINUTES = 20  # Generate TTS every 20 minuters while app is running

    # Text Generation settings
    TEXT_GEN_INTERVAL_MINUTES = 20 # Generate text examples every 20 minutes while app is running

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    MEDIA_ROOT = str(BASE_DIR / 'media_dev')
    BACKUP_ROOT = str(BASE_DIR / 'backups_dev')
    DB_SCHEMA = 'fluence_dev'
    SQLALCHEMY_DATABASE_URI = _schema_scoped_url(_BASE_DATABASE_URL, DB_SCHEMA)
    ENV = 'development'

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    MEDIA_ROOT = str(BASE_DIR / 'media_test')
    BACKUP_ROOT = str(BASE_DIR / 'backups_test')
    DB_SCHEMA = 'fluence_test'
    SQLALCHEMY_DATABASE_URI = _schema_scoped_url(_BASE_DATABASE_URL, DB_SCHEMA)
    ENV = 'testing'

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    DB_SCHEMA = 'fluence_prod'
    SQLALCHEMY_DATABASE_URI = _schema_scoped_url(_BASE_DATABASE_URL, DB_SCHEMA)
    ENV = 'production'
    MEDIA_ROOT = os.environ.get('PROD_MEDIA_ROOT', Config.MEDIA_ROOT)
    BACKUP_ROOT = os.environ.get('PROD_BACKUP_ROOT', Config.BACKUP_ROOT)

# Default to development
config = {
    'dev': DevelopmentConfig,
    'test': TestingConfig,
    'prod': ProductionConfig,
    'default': DevelopmentConfig
}