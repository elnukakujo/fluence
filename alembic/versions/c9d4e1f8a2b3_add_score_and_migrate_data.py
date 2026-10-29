"""add score table and migrate per-user scoring off elements

Revision ID: c9d4e1f8a2b3
Revises: f88f6fd7f3e9
Create Date: 2026-10-29

Single atomic transition to the per-user `score` table:
  upgrade: create `score`, backfill owner-keyed rows from element columns
           (raw SQL, owner resolved via lesson/language), drop the scoring
           columns from every element table, drop `collaboration_progress`.
  downgrade: reverse.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d4e1f8a2b3'
down_revision: Union[str, Sequence[str], None] = 'e700c909be5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Element tables and their scoring columns (all have score/last_seen_at/status).
ALL_ELEMENT_TABLES = (
    'language', 'lesson',
    'vocabulary', 'grammar', 'calligraphy', 'exercise',
    'word', 'character', 'passage',
)
# Tables that carry `difficulty` (features + components; containers do not).
DIFFICULTY_TABLES = (
    'vocabulary', 'grammar', 'calligraphy', 'exercise',
    'word', 'character', 'passage',
)


def upgrade() -> None:
    op.create_table('score',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('element_id', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('difficulty', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('current_lesson_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'element_id', name='uq_score_user_element'),
    )
    op.create_index(op.f('ix_score_id'), 'score', ['id'], unique=False)

    # Backfill owner-keyed score rows (raw SQL: independent of ORM column state).
    # Containers: owner is the row's own user_id; difficulty defaults to 0.5.
    op.execute("""
        INSERT INTO score (id, user_id, element_id, score, difficulty, created_at, last_seen_at, current_lesson_id)
        SELECT 'sc_' || id, user_id, id, score, 0.5, created_at, last_seen_at, current_lesson_id
        FROM language
    """)
    op.execute("""
        INSERT INTO score (id, user_id, element_id, score, difficulty, created_at, last_seen_at)
        SELECT 'sc_' || id, user_id, id, score, 0.5, created_at, last_seen_at
        FROM lesson
    """)
    # Features: owner = the lesson's owner (via lesson.user_id).
    for table in ('vocabulary', 'grammar', 'calligraphy', 'exercise'):
        op.execute(f"""
            INSERT INTO score (id, user_id, element_id, score, difficulty, created_at, last_seen_at)
            SELECT 'sc_' || f.id, le.user_id, f.id, f.score, f.difficulty, f.created_at, f.last_seen_at
            FROM {table} f JOIN lesson le ON f.lesson_id = le.id
        """)
    # Components: owner = the language's owner (via language.user_id).
    for table in ('word', 'character', 'passage'):
        op.execute(f"""
            INSERT INTO score (id, user_id, element_id, score, difficulty, created_at, last_seen_at)
            SELECT 'sc_' || c.id, l.user_id, c.id, c.score, c.difficulty, c.created_at, c.last_seen_at
            FROM {table} c JOIN language l ON c.language_id = l.id
        """)

    # Drop scoring columns.
    for table in ALL_ELEMENT_TABLES:
        op.drop_column(table, 'status')
        op.drop_column(table, 'last_seen_at')
        op.drop_column(table, 'score')
    for table in DIFFICULTY_TABLES:
        op.drop_column(table, 'difficulty')
    op.drop_column('language', 'current_lesson_id')

    op.drop_index(op.f('ix_collaboration_progress_id'), table_name='collaboration_progress')
    op.drop_table('collaboration_progress')


def downgrade() -> None:
    op.create_table('collaboration_progress',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('element_id', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('difficulty', sa.Float(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_collaboration_progress_id'), 'collaboration_progress', ['id'], unique=False)

    # Re-add scoring columns (status as a computed column per type's threshold set).
    for table in ALL_ELEMENT_TABLES:
        op.add_column(table, sa.Column('score', sa.Integer(), nullable=False, server_default='0'))
    for table in DIFFICULTY_TABLES:
        op.add_column(table, sa.Column('difficulty', sa.Float(), nullable=False, server_default='0.5'))
    for table in ALL_ELEMENT_TABLES:
        op.add_column(table, sa.Column('last_seen_at', sa.DateTime(), nullable=True))
    op.add_column('language', sa.Column('current_lesson_id', sa.String(), nullable=True))

    op.add_column('language', sa.Column('status', sa.String(), sa.Computed(
        "CASE WHEN score = 0 THEN 'unstarted' WHEN score <= 30 THEN 'beginner' WHEN score <= 60 THEN 'intermediary' WHEN score <= 90 THEN 'advanced' ELSE 'fluent' END"), nullable=False))
    for table in ('lesson', 'vocabulary', 'grammar', 'calligraphy', 'exercise'):
        op.add_column(table, sa.Column('status', sa.String(), sa.Computed(
            "CASE WHEN score = 0 THEN 'unstarted' WHEN score < 75 THEN 'inprogress' WHEN score < 100 THEN 'revisiting' ELSE 'completed' END"), nullable=False))
    for table in ('word', 'character', 'passage'):
        op.add_column(table, sa.Column('status', sa.String(), sa.Computed(
            "CASE WHEN score = 0 THEN 'unseen' WHEN score <= 10 THEN 'introduced' WHEN score <= 50 THEN 'learning' WHEN score <= 75 THEN 'practicing' WHEN score <= 90 THEN 'review' ELSE 'mastered' END"), nullable=False))

    # Back-populate element columns from score rows (owner == user_id match).
    op.execute("""
        UPDATE language l SET score = s.score, last_seen_at = s.last_seen_at, current_lesson_id = s.current_lesson_id
        FROM score s WHERE s.element_id = l.id AND s.user_id = l.user_id
    """)
    op.execute("""
        UPDATE lesson le SET score = s.score, last_seen_at = s.last_seen_at
        FROM score s WHERE s.element_id = le.id AND s.user_id = le.user_id
    """)
    for table in ('vocabulary', 'grammar', 'calligraphy', 'exercise'):
        op.execute(f"""
            UPDATE {table} f SET score = s.score, difficulty = s.difficulty, last_seen_at = s.last_seen_at
            FROM score s, lesson le
            WHERE s.element_id = f.id AND f.lesson_id = le.id AND s.user_id = le.user_id
        """)
    for table in ('word', 'character', 'passage'):
        op.execute(f"""
            UPDATE {table} c SET score = s.score, difficulty = s.difficulty, last_seen_at = s.last_seen_at
            FROM score s, language l
            WHERE s.element_id = c.id AND c.language_id = l.id AND s.user_id = l.user_id
        """)

    op.drop_index(op.f('ix_score_id'), table_name='score')
    op.drop_table('score')
