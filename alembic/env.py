import os
from logging.config import fileConfig

from sqlalchemy import create_engine, inspect, text
from sqlalchemy import pool
from sqlalchemy.engine import make_url

from alembic import context
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

# Import all models so they register on Base.metadata before autogenerate diffs it.
import lapp.models  # noqa: F401
from lapp.core.database import Base
from config import config as app_config

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging. Skip when Alembic is invoked
# programmatically from the running app (DatabaseManager.run_migrations) — the
# app already configures logging, and fileConfig()'s disable_existing_loggers
# default would silence every app logger (lapp.*) for the rest of the process.
if config.config_file_name is not None and not config.attributes.get("skip_logging"):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Resolve the DB URL/schema. Precedence: whatever the caller already
# configured (e.g. DatabaseManager.run_migrations() sets sqlalchemy.url from
# the live engine - already schema-scoped via its search_path query param)
# > -x db_url=... on the alembic CLI > LAPP_ENV-selected app Config.
# Never silently override a URL the caller already provided - this file is
# re-executed by command.stamp()/upgrade() inside the running app process.
# If NONE of those are given (a bare `alembic upgrade head` from the CLI),
# fall through to applying every config's schema in one invocation.
_explicit_url = config.get_main_option("sqlalchemy.url")
_db_url_arg = context.get_x_argument(as_dictionary=True).get("db_url")
_env_arg = os.environ.get("LAPP_ENV")

_single_target_url = _explicit_url or _db_url_arg or (
    app_config[_env_arg].SQLALCHEMY_DATABASE_URI if _env_arg else None
)


def run_migrations_offline() -> None:
    url = _single_target_url or app_config["dev"].SQLALCHEMY_DATABASE_URI
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _run_migrations_against(url: str, bootstrap_if_fresh: bool) -> None:
    # NullPool: this connection is used once then discarded, no need to pool it.
    connectable = create_engine(url, poolclass=pool.NullPool)
    try:
        with connectable.connect() as connection:
            # Mirrors DatabaseManager.init_app(): the search_path schema must
            # exist before anything (including alembic_version) can be
            # created in it - a bare `alembic upgrade head` bypasses
            # DatabaseManager entirely, so this is the only place left to do it.
            options = make_url(url).query.get("options", "")
            if "-csearch_path=" in options:
                schema = options.split("-csearch_path=", 1)[1]
                connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                connection.commit()

            # Mirrors DatabaseManager.run_migrations()'s bootstrap check: a
            # schema that already has tables but no alembic_version (e.g.
            # TESTING's create_tables()-only path, or a pre-Alembic schema)
            # must be stamped at head, not replayed from scratch - replaying
            # would try to CREATE TABLEs that already exist.
            if bootstrap_if_fresh:
                migration_ctx = MigrationContext.configure(connection)
                is_fresh = migration_ctx.get_current_revision() is None
                has_tables = inspect(connectable).has_table("user")
                if is_fresh and has_tables:
                    # Stamp directly via MigrationContext rather than
                    # command.stamp() - the latter re-execs this very env.py
                    # script through the command layer, which we're already
                    # mid-execution of.
                    migration_ctx.stamp(ScriptDirectory.from_config(config), "head")
                    connection.commit()
                    return

            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


def run_migrations_online() -> None:
    if _single_target_url:
        # Single-schema path (DatabaseManager.run_migrations() or an explicit
        # -x db_url=/LAPP_ENV=) already did its own fresh-DB bootstrap check
        # before invoking Alembic; just run migrations normally here.
        _run_migrations_against(_single_target_url, bootstrap_if_fresh=False)
        return

    # Bare CLI invocation: bring every config's schema up to head.
    for env_name in ("dev", "test", "prod"):
        _run_migrations_against(app_config[env_name].SQLALCHEMY_DATABASE_URI, bootstrap_if_fresh=True)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
