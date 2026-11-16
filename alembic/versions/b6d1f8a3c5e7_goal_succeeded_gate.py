"""study goals: permanent `succeeded_at` on items, the radicals quota, and the persistent soft-gate table `lesson_gate`

Additive and idempotent (columns / table skipped when present). Existing data is migrated: an open new item whose element
already scores at least known (60) is stamped succeeded, and a learner whose language's first lesson scores at least known
gets the gate opened. Scores are the stored (not decayed) values, the best the database alone can tell. Take a backup first.

Revision ID: b6d1f8a3c5e7
Revises: a4e7c1d9b3f2
Create Date: 2026-11-16
"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b6d1f8a3c5e7'
down_revision: Union[str, Sequence[str], None] = 'a4e7c1d9b3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

KNOWN_FROM = 60          # frozen copy of shared/study-constants.json levels.knownFrom


def _cols(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def backfill(conn) -> dict:
    """Stamp succeeded items and open gates from the stored scores. Returns {"succeeded": n, "gates": n}."""
    now = datetime.now()
    stored: dict = {}
    for user_id, element_id, score in conn.execute(sa.text("SELECT user_id, element_id, score FROM score")):
        stored.setdefault((user_id, element_id), []).append(score)

    def level(user_id, element_id):
        """Mean over the element's rows; a vocabulary is the mean of its two sides (an unanswered side counts 0)."""
        if element_id.startswith("voc_"):
            sides = [stored.get((user_id, f"{element_id}#{s}")) for s in ("front", "back")]
            if any(sides):
                return sum(sum(v) / len(v) if v else 0.0 for v in sides) / 2
        rows = stored.get((user_id, element_id))
        return sum(rows) / len(rows) if rows else 0.0

    succeeded = 0
    for item_id, user_id, element_id in conn.execute(sa.text(
            "SELECT i.id, g.user_id, i.element_id FROM study_goal_item i JOIN study_goal g ON g.id = i.goal_id "
            "WHERE i.kind = 'new' AND i.succeeded_at IS NULL")).fetchall():
        if level(user_id, element_id) >= KNOWN_FROM:
            conn.execute(sa.text("UPDATE study_goal_item SET succeeded_at = :n WHERE id = :i"), {"n": now, "i": item_id})
            succeeded += 1

    gates = 0
    for language_id, user_id in conn.execute(sa.text("SELECT id, user_id FROM language")).fetchall():
        first = conn.execute(sa.text("SELECT id FROM lesson WHERE language_id = :l ORDER BY position, created_at, id LIMIT 1"), {"l": language_id}).scalar()
        if first is None or level(user_id, first) < KNOWN_FROM:
            continue
        if conn.execute(sa.text("SELECT 1 FROM lesson_gate WHERE user_id = :u AND language_id = :l"), {"u": user_id, "l": language_id}).first():
            continue
        n = conn.execute(sa.text("SELECT COUNT(*) FROM lesson_gate")).scalar()
        conn.execute(sa.text("INSERT INTO lesson_gate (id, user_id, language_id, unlocked_lesson_id, unlocked_at) VALUES (:id, :u, :l, :f, :n)"),
                     {"id": f"gate_G{n + 1}", "u": user_id, "l": language_id, "f": first, "n": now})
        gates += 1
    return {"succeeded": succeeded, "gates": gates}


def upgrade() -> None:
    goal, item = _cols("study_goal"), _cols("study_goal_item")
    for name in ("n_radicals", "r_radicals"):
        if name not in goal:
            op.add_column("study_goal", sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
    if "succeeded_at" not in item:
        op.add_column("study_goal_item", sa.Column("succeeded_at", sa.DateTime(), nullable=True))
    if "radical" not in item:
        op.add_column("study_goal_item", sa.Column("radical", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "lesson_gate" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "lesson_gate",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("user.id"), nullable=False),
            sa.Column("language_id", sa.String(), sa.ForeignKey("language.id", ondelete="CASCADE"), nullable=False),
            sa.Column("unlocked_lesson_id", sa.String(), nullable=False),
            sa.Column("unlocked_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("user_id", "language_id", name="uq_lesson_gate_user_language"),
        )
        op.create_index("ix_lesson_gate_id", "lesson_gate", ["id"])
    backfill(op.get_bind())


def downgrade() -> None:
    if "lesson_gate" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("lesson_gate")
    for table, names in (("study_goal_item", ("radical", "succeeded_at")), ("study_goal", ("r_radicals", "n_radicals"))):
        have = _cols(table)
        for n in names:
            if n in have:
                op.drop_column(table, n)
