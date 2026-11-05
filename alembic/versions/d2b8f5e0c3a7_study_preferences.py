"""study preferences: side pattern / type boost-ban / review layout, exercise_user_pref, study_goal(+item)

Revision ID: d2b8f5e0c3a7
Revises: c1a7e4d9b2f6
Create Date: 2026-11-05
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2b8f5e0c3a7'
down_revision: Union[str, Sequence[str], None] = 'c1a7e4d9b2f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def migrate_preferred_types(conn) -> None:
    """Every preferred exercise type becomes a `boost` in exercise_type_prefs."""
    for pid, types in conn.execute(sa.text("SELECT id, preferred_exercise_types FROM user_preferences")).fetchall():
        if isinstance(types, str):
            types = json.loads(types)
        prefs = {t: "boost" for t in (types or [])}
        conn.execute(sa.text("UPDATE user_preferences SET exercise_type_prefs = CAST(:p AS JSON) WHERE id = :i"),
                     {"p": json.dumps(prefs), "i": pid})


def upgrade() -> None:
    op.add_column('user_preferences', sa.Column('voc_side_pattern', sa.JSON(), nullable=True))
    op.add_column('user_preferences', sa.Column('exercise_type_prefs', sa.JSON(), nullable=False, server_default='{}'))
    op.add_column('user_preferences', sa.Column('review_layout', sa.JSON(), nullable=True))
    migrate_preferred_types(op.get_bind())
    op.drop_column('user_preferences', 'preferred_exercise_types')

    op.create_table(
        'exercise_user_pref',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('exercise_id', sa.String(), nullable=False),
        sa.Column('mode', sa.String(), nullable=False),
        sa.UniqueConstraint('user_id', 'exercise_id', name='uq_exercise_user_pref'),
    )
    op.create_index('ix_exercise_user_pref_id', 'exercise_user_pref', ['id'])
    op.create_table(
        'study_goal',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('language_id', sa.String(), sa.ForeignKey('language.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('n_vocabulary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('n_grammar', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('n_calligraphy', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index('ix_study_goal_id', 'study_goal', ['id'])
    op.create_table(
        'study_goal_item',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('goal_id', sa.String(), sa.ForeignKey('study_goal.id', ondelete='CASCADE'), nullable=False),
        sa.Column('element_id', sa.String(), nullable=False),
        sa.Column('cycle_start', sa.Date(), nullable=False),
        sa.Column('picked_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_study_goal_item_id', 'study_goal_item', ['id'])


def downgrade() -> None:
    op.drop_table('study_goal_item')
    op.drop_table('study_goal')
    op.drop_table('exercise_user_pref')
    op.add_column('user_preferences', sa.Column('preferred_exercise_types', sa.JSON(), nullable=True))
    op.execute("UPDATE user_preferences SET preferred_exercise_types = '[]'")
    op.drop_column('user_preferences', 'review_layout')
    op.drop_column('user_preferences', 'exercise_type_prefs')
    op.drop_column('user_preferences', 'voc_side_pattern')
