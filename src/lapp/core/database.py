# src/lapp/core/database.py
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, Type, TypeVar, Any

import sqlalchemy
from sqlalchemy import create_engine, select, update, delete, Table, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, scoped_session, selectinload
from sqlalchemy.inspection import inspect
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from flask import Flask

logger = logging.getLogger(__name__)

# Create base for models
Base = declarative_base()

# Type variable for model classes
model_types = TypeVar('T', bound="Base")

# Prefixes for generate_new_id(), keyed by model class name.
ID_PREFIXES = {
    "Language": "lang_L",
    "Lesson": "lesson_L",
    "Vocabulary": "voc_V",
    "Grammar": "gram_G",
    "Calligraphy": "call_C",
    "Exercise": "ex_E",
    "Character": "char_C",
    "Word": "word_W",
    "Passage": "pass_P",
    "User": "user_U",
    "UserSession": "sess_S",
    "UserPreferences": "pref_P",
    "Source": "src_S",
    "Tag": "tag_T",
    "ProgressTracking": "pt_P",
    "DailyStats": "day_D",
    "CommitmentLog": "cl_C",
    "Collaboration": "collab_C",
    "CollaborationProgress": "cp_P",
}

# Backing store for generate_new_id()'s atomic counters. One row per entity
# type; an atomic "UPDATE ... SET next_value = next_value + 1 RETURNING" is
# race-free under concurrent writers on both SQLite and Postgres, unlike the
# old max(existing_ids) + 1 scan.
id_counter_table = Table(
    "id_counter",
    Base.metadata,
    Column("entity_type", String, primary_key=True),
    Column("next_value", Integer, nullable=False),
)

# Backup trigger counter: how many session_scope() transactions that wrote data
# have committed since the last backup. One row in id_counter_table, entity_type
# keyed by MUTATION_COUNTER_ENTITY. A before_flush listener (see _mark_mutated)
# flags sessions that modified ORM state, so read-only scopes — monitoring
# pings, dashboard polls — don't count. Internal id_counter bookkeeping via raw
# Core UPDATE doesn't count either; those aren't user operations.
# ponytail: flag rides on session.info; per-write-type tracking not worth it.
MUTATION_COUNTER_ENTITY = "__mutation_count__"


def increment_mutation_counter(session: Session) -> int:
    """Atomically bump the mutation counter; seeds the row on first use."""
    stmt = postgresql_insert(id_counter_table).values(
        entity_type=MUTATION_COUNTER_ENTITY, next_value=1
    ).on_conflict_do_update(
        index_elements=["entity_type"],
        set_={"next_value": id_counter_table.c.next_value + 1},
    ).returning(id_counter_table.c.next_value)
    return session.execute(stmt).scalar_one()


def get_mutation_count(session: Optional[Session] = None) -> int:
    """Current mutation count; 0 when no row exists yet."""
    close_session = session is None
    if close_session:
        session = db_manager.get_session()
    try:
        row = session.execute(
            select(id_counter_table.c.next_value).where(
                id_counter_table.c.entity_type == MUTATION_COUNTER_ENTITY
            )
        ).first()
        return row[0] if row else 0
    finally:
        if close_session:
            session.close()


def reset_mutation_counter(session: Optional[Session] = None) -> None:
    """Zero the counter (row deletion reads back as 0)."""
    close_session = session is None
    if close_session:
        session = db_manager.get_session()
    try:
        session.execute(delete(id_counter_table).where(
            id_counter_table.c.entity_type == MUTATION_COUNTER_ENTITY
        ))
        if close_session:
            session.commit()
    finally:
        if close_session:
            session.close()


def _mark_mutated(session: Session, flush_context, instances) -> None:
    """before_flush listener: flag sessions with pending ORM changes.

    Fires before flush clears new/dirty/deleted, so it catches writes even
    when a mid-body flush (e.g. CRUD with commit=False) runs before the
    session_scope() check.
    """
    if session.new or session.dirty or session.deleted:
        session.info['_mutated'] = True

class DatabaseManager:
    """
    Manages database connections, sessions, and CRUD operations.
    
    This class provides a centralized interface for database operations,
    including initialization, session management, and common CRUD methods.
    """
    
    def __init__(self, database_uri: Optional[str] = None):
        """
        Initialize the DatabaseManager.
        
        Args:
            database_uri: SQLAlchemy database URI. If None, will be set later via init_app()
        """
        self.engine: Optional[sqlalchemy.engine.Engine] = None
        self.SessionLocal: Optional[sessionmaker] = None
        self._scoped_session: Optional[scoped_session] = None
        
        if database_uri:
            self._create_engine(database_uri)
    
    def _create_engine(self, database_uri: str) -> None:
        """Create SQLAlchemy engine and session factory."""
        self.engine = create_engine(
            database_uri,
            echo=False,  # Set to True for SQL debugging
            pool_pre_ping=True,  # Verify connections before using
            pool_size=10,
            max_overflow=20,
        )
        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False,
            # Keep attributes readable after commit/close — routes serialize
            # returned ORM objects via to_dict() once the session is gone.
            expire_on_commit=False,
        )
        sqlalchemy.event.listen(self.SessionLocal, 'before_flush', _mark_mutated)
        self._scoped_session = scoped_session(self.SessionLocal)
    
    def init_app(self, app: Flask) -> None:
        """
        Initialize database with Flask app.
        
        Args:
            app: Flask application instance
        """
        database_uri = app.config.get('SQLALCHEMY_DATABASE_URI')

        if not database_uri:
            raise ValueError("SQLALCHEMY_DATABASE_URI not found in app config")

        self._create_engine(database_uri)

        db_schema = app.config.get('DB_SCHEMA')
        if db_schema:
            with self.engine.connect() as connection:
                connection.execute(sqlalchemy.text(f'CREATE SCHEMA IF NOT EXISTS "{db_schema}"'))
                connection.commit()
            logger.info(f"Ensured schema exists: {db_schema}")

        # Register teardown to close sessions
        @app.teardown_appcontext
        def shutdown_session(exception=None):
            self.close_session()

        logger.info("DatabaseManager initialized with Flask app")
    
    def create_tables(self) -> None:
        """Create all tables defined in models."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized. Call init_app() first.")

        import lapp.models  # Ensure models are imported in the right order

        Base.metadata.create_all(self.engine)
        logger.info("Database tables created successfully")

    def run_migrations(self) -> None:
        """Bring the schema up to date, bootstrapping brand-new databases.

        - No `alembic_version` table yet (fresh DB): create the full schema via
          create_all(), then stamp it at Alembic's baseline revision so future
          `upgrade head` calls apply only genuinely new migrations.
        - Otherwise: run `alembic upgrade head` to apply any pending revisions.

        This replaces bare create_all() as the app-startup path; create_tables()
        stays available directly for tests/scripts that want an unmanaged schema.
        """
        if not self.engine:
            raise RuntimeError("Database engine not initialized. Call init_app() first.")

        from alembic import command
        from alembic.config import Config as AlembicConfig
        from alembic.runtime.migration import MigrationContext

        repo_root = Path(__file__).resolve().parents[3]
        alembic_cfg = AlembicConfig(str(repo_root / "alembic.ini"))
        # We're running in-app, where logging is already configured — tell
        # alembic/env.py to skip its own fileConfig() so it doesn't clobber
        # the app's handlers/levels (see alembic/env.py).
        alembic_cfg.attributes["skip_logging"] = True
        alembic_cfg.set_main_option("script_location", str(repo_root / "alembic"))
        # Escape "%" for ConfigParser's interpolation - our URLs contain "%3D"
        # (percent-encoded "=" from the search_path query param).
        alembic_cfg.set_main_option("sqlalchemy.url", self.engine.url.render_as_string(hide_password=False).replace("%", "%%"))

        with self.engine.connect() as connection:
            is_fresh = MigrationContext.configure(connection).get_current_revision() is None
            has_tables = inspect(self.engine).has_table("user")

        if is_fresh and not has_tables:
            self.create_tables()
            command.stamp(alembic_cfg, "head")
            logger.info("Fresh database: created schema via create_all() and stamped at head")
        elif is_fresh and has_tables:
            # Pre-Alembic database (created before this migration path existed).
            command.stamp(alembic_cfg, "head")
            logger.info("Existing pre-Alembic database: stamped at head without altering schema")
        else:
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrated to head")
    
    def drop_tables(self) -> None:
        """Drop all tables (use with caution!)."""
        if not self.engine:
            raise RuntimeError("Database engine not initialized")
        
        Base.metadata.drop_all(self.engine)
        logger.warning("All database tables dropped")
    
    def get_session(self) -> Session:
        """
        Get a new database session.
        
        Returns:
            Session: SQLAlchemy session instance
        """
        if not self._scoped_session:
            raise RuntimeError("Database not initialized. Call init_app() first.")
        
        return self._scoped_session()
    
    def close_session(self) -> None:
        """Close the current scoped session."""
        if self._scoped_session:
            self._scoped_session.remove()

    @contextmanager
    def session_scope(self):
        """One unit of work: commit on success, rollback on error, always close.

        Pass the yielded session to CRUD calls with `commit=False` so the whole
        cascade commits once here instead of once per call. Replaces the repeated
        `owns_session = session is None` boilerplate in services.
        """
        session = self.get_session()
        try:
            yield session
            session.flush()  # materialize pending writes; before_flush sets the flag
            if session.info.get('_mutated'):
                # Same txn as the writes; a rollback discards the increment.
                increment_mutation_counter(session)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _load_relationships(self, query, model_class: Type[model_types], load_relationships: bool = True):
        """
        Helper method to add relationship loading to a query.
        
        Args:
            query: SQLAlchemy query object
            model_class: The model class being queried
            load_relationships: Whether to load relationships
        
        Returns:
            Query with relationship loading options added
        """
        if not load_relationships:
            return query
        
        # Get all relationships for the model
        mapper = inspect(model_class)
        
        # Use selectinload for one-to-many relationships (more efficient for collections)
        for relationship in mapper.relationships:
            query = query.options(selectinload(getattr(model_class, relationship.key)))
        
        return query
    
    def _eager_load_object_relationships(self, obj: model_types, session: Session) -> None:
        """
        Eagerly load all relationships on an existing object.
        This ensures the object can be used even after the session closes.
        
        Args:
            obj: The object whose relationships should be loaded
            session: The session containing the object
        """
        mapper = inspect(type(obj))
        
        # Access each relationship to trigger loading while session is still open
        for relationship in mapper.relationships:
            try:
                # Access the relationship attribute to load it
                attr = getattr(obj, relationship.key)
                # If it's a list, access its length to ensure it's fully loaded
                if isinstance(attr, list):
                    len(attr)
            except Exception as e:
                logger.warning(f"Could not load relationship {relationship.key}: {e}")
    
    # ==================== CRUD Operations ====================
    
    def insert(self, obj: model_types, session: Optional[Session] = None, load_relationships: bool = True, commit: bool = True) -> Optional[model_types]:
        """
        Insert a single object into the database.
        
        Args:
            obj: SQLAlchemy model instance to insert
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships before closing session
        
        Returns:
            The inserted object, or None if failed
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            session.add(obj)
            # commit=False defers to the enclosing session_scope; flush still
            # populates generated IDs and surfaces IntegrityError here.
            session.commit() if commit else session.flush()
            session.refresh(obj)  # Refresh to get generated IDs

            # Load all relationships before closing the session
            if load_relationships:
                self._eager_load_object_relationships(obj, session)

            logger.info(f"Inserted {type(obj).__name__} with id: {obj.id}")
            return obj
        except IntegrityError as e:
            session.rollback()
            logger.warning(f"Insert failed due to integrity error: {e}")
            # Attempt to modify existing record
            return self.modify(obj, session, load_relationships, commit=commit)
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Insert failed: {e}")
            return None
        finally:
            if close_session:
                session.close()
    
    def insert_many(self, objs: list[model_types], session: Optional[Session] = None, load_relationships: bool = True, commit: bool = True) -> bool:
        """
        Insert multiple objects into the database.
        
        Args:
            objs: List of SQLAlchemy model instances
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships before closing session
        
        Returns:
            True if all inserts succeeded, False otherwise
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            session.add_all(objs)
            session.commit() if commit else session.flush()
            for obj in objs:
                session.refresh(obj)
                # Load all relationships before closing the session
                if load_relationships:
                    self._eager_load_object_relationships(obj, session)
            logger.info(f"Inserted {len(objs)} records")
            return True
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Bulk insert failed: {e}")
            return False
        finally:
            if close_session:
                session.close()
    
    def modify(self, obj: model_types, session: Optional[Session] = None, load_relationships: bool = True, commit: bool = True) -> Optional[model_types]:
        """
        Update an existing record or insert if not found.
        
        Uses SQLAlchemy's merge() which handles both update and insert.
        
        Args:
            obj: SQLAlchemy model instance
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships before closing session
        
        Returns:
            The merged object, or None if failed
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            merged_obj = session.merge(obj)
            session.commit() if commit else session.flush()
            session.refresh(merged_obj)
            
            # Load all relationships before closing the session
            if load_relationships:
                self._eager_load_object_relationships(merged_obj, session)
            
            logger.info(f"Modified {type(merged_obj).__name__} with id: {merged_obj.id}")
            return merged_obj
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Modify failed: {e}")
            return None
        finally:
            if close_session:
                session.close()
    
    def delete(self, obj: model_types, session: Optional[Session] = None, commit: bool = True) -> bool:
        """
        Delete a record from the database.
        
        Args:
            obj: SQLAlchemy model instance to delete
            session: Optional session. If None, creates a new one.
        
        Returns:
            True if deletion succeeded, False otherwise
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            # Find existing record by primary key with relationships loaded
            existing = self.find_by_pk(obj, session, load_relationships=True)
            
            if not existing:
                logger.warning(f"Delete failed: Record not found")
                return False
            
            session.delete(existing)
            session.commit() if commit else session.flush()
            logger.info(f"Deleted {type(obj).__name__} with id: {obj.id}")
            return True
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Delete failed for {type(obj).__name__} id={obj.id}: {e}")
            return False
        finally:
            if close_session:
                session.close()
    
    def find_by_pk(
        self, 
        obj: model_types, 
        session: Optional[Session] = None,
        load_relationships: bool = True
    ) -> Optional[model_types]:
        """
        Find an existing record by primary key.
        
        Args:
            obj: Model instance containing primary key values
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships
        
        Returns:
            Existing record or None if not found
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            model_class = type(obj)
            mapper = inspect(model_class)
            
            # Extract primary key values
            pk_attrs = {key.name: getattr(obj, key.name) for key in mapper.primary_key}
            
            # Build query
            query = session.query(model_class).filter_by(**pk_attrs)
            
            # Add relationship loading
            query = self._load_relationships(query, model_class, load_relationships)
            
            existing = query.first()
            return existing
        finally:
            if close_session:
                session.close()
    
    def find_by_attr(
        self,
        model_class: Type[model_types],
        attr_values: dict[str, Any],
        session: Optional[Session] = None,
        load_relationships: bool = True,
        many: bool = False
    ) -> Optional[model_types]:
        """
        Find a record by specific attributes.
        
        Args:
            model_class: The SQLAlchemy model class to query
            attr_values: Dictionary of attribute names and values
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships
            many: If True, return a list of matching records instead of just one
        
        Returns:
            The matching record or None if not found
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            query = session.query(model_class).filter_by(**attr_values)
            
            # Add relationship loading
            query = self._load_relationships(query, model_class, load_relationships)
            
            if many:
                existing = query.all()
            else:
                existing = query.first()
            
            if existing:
                return existing
            else:
                logger.warning(f"No {model_class.__name__} found with attributes: {attr_values}")
                return None
        finally:
            if close_session:
                session.close()
    
    def find_all(
        self,
        model_class: Type[model_types] | list[Type[model_types]],
        filters: Optional[dict[str, Any]] = None,
        session: Optional[Session] = None,
        load_relationships: bool = True
    ) -> list[model_types]:
        """
        Find all records matching optional filters.
        
        Args:
            model_class: The SQLAlchemy model class to query (or list of classes)
            filters: Optional dictionary of filter conditions
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships
        
        Returns:
            List of matching records
        """
        close_session = False
        if session is None:
            session = self.get_session()
            close_session = True
        
        try:
            if not isinstance(model_class, list):
                model_class = [model_class]
            
            results = []

            for model in model_class:
                query = session.query(model)
                
                if filters:
                    query = query.filter_by(**filters)
                
                # Add relationship loading
                query = self._load_relationships(query, model, load_relationships)
            
                results += query.all()
            return results
        finally:
            if close_session:
                session.close()
    
    def get_by_id(
        self,
        model_class: Type[model_types],
        id_value: Any,
        session: Optional[Session] = None,
        load_relationships: bool = True
    ) -> Optional[model_types]:
        """
        Convenience method to get a record by its ID.
        
        Args:
            model_class: The SQLAlchemy model class to query
            id_value: The ID value to search for
            session: Optional session. If None, creates a new one.
            load_relationships: If True, eagerly load all relationships
        
        Returns:
            The matching record or None if not found
        """
        return self.find_by_attr(
            model_class, 
            {"id": id_value}, 
            session, 
            load_relationships
        )
    
    def generate_new_id(
        self,
        model_class: Type[model_types],
        session: Optional[Session] = None,
    ) -> str:
        """
        Generate a new sequential ID for any model type, e.g. "voc_V42".

        Backed by an atomic per-entity-type counter (id_counter_table), so
        concurrent callers never race to compute the same next number the way
        a max(existing_ids) + 1 scan would. The counter is lazily seeded from
        the current max existing ID the first time an entity type is used,
        so numbering picks up where legacy rows left off; every call after
        that is a single atomic UPDATE ... RETURNING, not a full table scan.

        Args:
            model_class: The model class to generate ID for
            session: Optional session. If None, creates a new one and commits;
                if given, the caller's transaction owns commit (matches the
                commit=False convention used by insert/modify/delete).

        Returns:
            New ID string (e.g., "voc_V42")

        Raises:
            ValueError: If model_class has no configured ID prefix
        """
        close_session = session is None
        if close_session:
            session = self.get_session()

        try:
            entity_type = model_class.__name__
            if entity_type not in ID_PREFIXES:
                raise ValueError(f"Unsupported model class: {entity_type}")
            prefix = ID_PREFIXES[entity_type]

            next_num = self._atomic_next_id(session, entity_type, model_class)

            if close_session:
                session.commit()
            else:
                session.flush()

            return f"{prefix}{next_num}"
        except Exception:
            if close_session:
                session.rollback()
            raise
        finally:
            if close_session:
                session.close()

    def _atomic_next_id(self, session: Session, entity_type: str, model_class: Type[model_types]) -> int:
        """Get-and-increment on id_counter_table; seeds the row on first use."""
        exists = session.execute(
            select(id_counter_table.c.entity_type).where(id_counter_table.c.entity_type == entity_type)
        ).first()

        if exists is None:
            seed = self._legacy_max_id(session, model_class) + 1
            # on_conflict_do_nothing: if a concurrent caller seeds first, this is a no-op and
            # the UPDATE below still runs atomically against whichever row won.
            stmt = postgresql_insert(id_counter_table).values(entity_type=entity_type, next_value=seed)
            stmt = stmt.on_conflict_do_nothing(index_elements=["entity_type"])
            session.execute(stmt)

        result = session.execute(
            update(id_counter_table)
            .where(id_counter_table.c.entity_type == entity_type)
            .values(next_value=id_counter_table.c.next_value + 1)
            .returning(id_counter_table.c.next_value)
        )
        return result.scalar_one() - 1

    def _legacy_max_id(self, session: Session, model_class: Type[model_types]) -> int:
        """One-time scan for the highest numeric suffix among existing IDs (e.g. "voc_V42" -> 42)."""
        existing_ids = session.scalars(select(model_class.id)).all()
        numbers = []
        for id_str in existing_ids:
            try:
                numbers.append(int(id_str.split("_")[-1][1:]))
            except (ValueError, IndexError):
                continue
        return max(numbers) if numbers else 0


# Global instance
db_manager = DatabaseManager()


def transactional(method):
    """Give a service method a managed `session` without the owns_session boilerplate.

    - Called with `session=None` (the outermost caller): opens a `session_scope`,
      injects it, and commits/rolls back once around the whole method.
    - Called with a caller-supplied `session`: runs inside it and lets that outer
      caller own commit/rollback — so a cascade of services commits exactly once.

    Wrapped methods should pass `commit=False` to db_manager CRUD calls; the scope
    (opened here or by an outer caller) is what commits.
    """
    import functools

    @functools.wraps(method)
    def wrapper(self, *args, session: Optional[Session] = None, **kwargs):
        if session is not None:
            return method(self, *args, session=session, **kwargs)
        with db_manager.session_scope() as owned:
            return method(self, *args, session=owned, **kwargs)

    return wrapper


def stack_related(existing_items, incoming_refs, model_class, session: Session):
    """Union existing ORM objects with incoming {id: ...}-like refs, by id.

    Used to combine tags/sources when resolving a create() duplicate — like
    media, they're not something the user picks one version of.
    """
    existing_items = list(existing_items or [])
    existing_ids = {item.id for item in existing_items}
    new_ids = [ref.id for ref in (incoming_refs or []) if getattr(ref, "id", None) and ref.id not in existing_ids]
    if not new_ids:
        return existing_items
    new_items = session.query(model_class).filter(model_class.id.in_(new_ids)).all()
    return existing_items + new_items


def resolve_related(refs, model_class, session: Session):
    """Query and return the ORM objects matching incoming {id: ...}-like refs, by id."""
    ids = [ref.id for ref in (refs or []) if getattr(ref, "id", None)]
    return session.query(model_class).filter(model_class.id.in_(ids)).all() if ids else []

# Convenience function for Flask initialization
def init_db(app: Flask) -> DatabaseManager:
    """
    Initialize database with Flask app.
    
    Args:
        app: Flask application instance
    
    Returns:
        DatabaseManager instance
    """
    db_manager.init_app(app)
    if app.config.get("TESTING"):
        # Tests want a fast, unmanaged schema reset (see tests/conftest.py), not migrations.
        db_manager.create_tables()
    else:
        db_manager.run_migrations()
    return db_manager