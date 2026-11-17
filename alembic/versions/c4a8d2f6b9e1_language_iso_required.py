"""`language.iso1` unique per user, and NOT NULL once every course has one

Run this only after the owner has dispositioned `scripts/language_migration_report.py`. Idempotent. The unique index
always applies (NULLs do not collide); NOT NULL is skipped, with a log line, while any course still lacks an iso1.

Revision ID: c4a8d2f6b9e1
Revises: b7e2a4c9d1f6
Create Date: 2026-11-17
"""
import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4a8d2f6b9e1'
down_revision: Union[str, Sequence[str], None] = 'b7e2a4c9d1f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

log = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uq_language_user_iso1" not in {u["name"] for u in insp.get_unique_constraints("language")}:
        op.create_unique_constraint("uq_language_user_iso1", "language", ["user_id", "iso1"])
    missing = bind.execute(sa.text("SELECT count(*) FROM language WHERE iso1 IS NULL")).scalar()
    if missing:
        log.warning("language.iso1 stays nullable: %s course(s) still have no supported language (see the report)", missing)
    else:
        op.alter_column("language", "iso1", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    op.alter_column("language", "iso1", existing_type=sa.String(), nullable=True)
    if "uq_language_user_iso1" in {u["name"] for u in insp.get_unique_constraints("language")}:
        op.drop_constraint("uq_language_user_iso1", "language", type_="unique")
