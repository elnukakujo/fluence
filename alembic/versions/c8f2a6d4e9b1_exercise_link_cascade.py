"""exercise links go with the element they point to (ON DELETE CASCADE)

Deleting a vocabulary, grammar or calligraphy item that an exercise links to used to fail at the database (the link row
blocked it) and the delete came back as "failed". The link rows now go with either end; the exercise itself stays.

Revision ID: c8f2a6d4e9b1
Revises: b5e1c9d3a7f2
Create Date: 2026-11-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c8f2a6d4e9b1'
down_revision: Union[str, Sequence[str], None] = 'b5e1c9d3a7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# link table -> {column: referred table}
LINKS = {
    'exercise_vocabulary_link': {'exercise_id': 'exercise', 'vocabulary_id': 'vocabulary'},
    'exercise_grammar_link': {'exercise_id': 'exercise', 'grammar_id': 'grammar'},
    'exercise_calligraphy_link': {'exercise_id': 'exercise', 'calligraphy_id': 'calligraphy'},
}


def _recreate(ondelete: str | None) -> None:
    inspector = sa.inspect(op.get_bind())
    for table, columns in LINKS.items():
        for fk in inspector.get_foreign_keys(table):   # the names are the database's own, not assumed
            column = fk['constrained_columns'][0]
            op.drop_constraint(fk['name'], table, type_='foreignkey')
            op.create_foreign_key(fk['name'], table, columns[column], [column], ['id'], ondelete=ondelete)


def upgrade() -> None:
    _recreate('CASCADE')


def downgrade() -> None:
    _recreate(None)
