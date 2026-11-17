"""score: per-skill rows, stability, leech and same-day-gain columns; progress_tracking skill/evidence/levels

Additive and idempotent. Every existing score row keeps its score, difficulty, created_at and last_seen_at;
each element gets one row per skill of its kind (stand-in matrix, TODO(owner)), all starting at the element's
current score, so no level goes up. Stability = min(180, 2 * 2^k) with k = past correct answers (floor 2).
Aggregate rows (lesson, language, word, passage, exercise) keep one "recall" row: they are derived and are
rebuilt per skill from their children by the new aggregate (spec 2, Task 5).
Take a backup first (scripts/score_migration_dry_run.py refuses to run without a fresh one).

Revision ID: d9a3f6b2c8e1
Revises: c8e4f2a9d1b6
Create Date: 2026-11-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9a3f6b2c8e1'
down_revision: Union[str, Sequence[str], None] = 'c8e4f2a9d1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Frozen copy of the stand-in skill matrix (element_kinds.py holds the live one; a test keeps them equal).
MATRIX = {
    "voc_": ("recognition", "recall"),
    "gram_": ("recognition",),
    "call_": ("recall",),
    "char_": ("recall",),
}
DEFAULT_SKILLS = ("recall",)
INITIAL_STABILITY, STABILITY_CAP = 2.0, 180.0

NEW_SCORE_COLUMNS = [
    ("skill", sa.String(), sa.text("'recall'")),
    ("stability", sa.Float(), sa.text("2.0")),
    ("is_leech", sa.Boolean(), sa.text("false")),
    ("recent", sa.String(), sa.text("''")),
    ("day_gain", sa.Float(), sa.text("0")),
]
NEW_TRACKING_COLUMNS = ["skill", "evidence_type", "level_before", "level_after"]
OLD_UNIQUE, NEW_UNIQUE = "uq_score_user_element", "uq_score_user_element_skill"


def _skills_for(element_id: str) -> tuple:
    for prefix, skills in MATRIX.items():
        if element_id.startswith(prefix):
            return skills
    return DEFAULT_SKILLS


def _reserve_ids(conn, n: int) -> int:
    """Reserve n Score ids from the id_counter (seeded from the highest existing sc_S<n>); returns the first number."""
    if conn.execute(sa.text("SELECT 1 FROM id_counter WHERE entity_type = 'Score'")).first() is None:
        nums = []
        for (i,) in conn.execute(sa.text("SELECT id FROM score")):
            try:
                nums.append(int(i.split("_")[-1][1:]))
            except (ValueError, IndexError):
                continue
        conn.execute(sa.text("INSERT INTO id_counter (entity_type, next_value) VALUES ('Score', :v)"), {"v": max(nums, default=0) + 1})
    end = conn.execute(sa.text("UPDATE id_counter SET next_value = next_value + :n WHERE entity_type = 'Score' RETURNING next_value"), {"n": n}).scalar_one()
    return end - n


def _stability(correct: int) -> float:
    return min(STABILITY_CAP, INITIAL_STABILITY * 2 ** min(correct, 10))   # 2^8 already exceeds the cap


def backfill_skills(conn) -> None:
    """One row per (user, element, skill) of the element's kind, and stability from past correct answers."""
    correct = {(u, e): n for u, e, n in conn.execute(sa.text(
        "SELECT user_id, split_part(element_id, '#', 1), count(*) FROM progress_tracking WHERE result GROUP BY 1, 2"))}
    groups: dict = {}
    for r in conn.execute(sa.text(
            "SELECT id, user_id, element_id, skill, score, difficulty, created_at, last_seen_at, current_lesson_id "
            "FROM score ORDER BY id")):
        groups.setdefault((r.user_id, r.element_id), []).append(r)

    inserts = []
    for (user_id, element_id), rows in groups.items():
        targets, have = _skills_for(element_id), {r.skill for r in rows}
        if not have & set(targets):                       # e.g. grammar: the lone "recall" row becomes "recognition"
            conn.execute(sa.text("UPDATE score SET skill = :s WHERE id = :id"), {"s": targets[0], "id": rows[0].id})
            have = {targets[0]}
        inserts += [(rows[0], s) for s in targets if s not in have]

    if inserts:
        first = _reserve_ids(conn, len(inserts))
        for k, (r, skill) in enumerate(inserts):
            conn.execute(sa.text(
                "INSERT INTO score (id, user_id, element_id, skill, score, difficulty, created_at, last_seen_at, current_lesson_id) "
                "VALUES (:id, :u, :e, :sk, :s, :d, :c, :l, :cl)"),
                {"id": f"sc_S{first + k}", "u": r.user_id, "e": r.element_id, "sk": skill, "s": r.score,
                 "d": r.difficulty, "c": r.created_at, "l": r.last_seen_at, "cl": r.current_lesson_id})

    for r in conn.execute(sa.text("SELECT id, user_id, element_id FROM score")).fetchall():
        conn.execute(sa.text("UPDATE score SET stability = :st WHERE id = :id"),
                     {"st": _stability(correct.get((r.user_id, r.element_id.split("#")[0]), 0)), "id": r.id})


def collapse_skills(conn) -> None:
    """Back to one row per (user, element): keep the "recall" row, else the first."""
    groups: dict = {}
    for r in conn.execute(sa.text("SELECT id, user_id, element_id, skill FROM score ORDER BY id")):
        groups.setdefault((r.user_id, r.element_id), []).append(r)
    for rows in groups.values():
        keep = next((r for r in rows if r.skill == "recall"), rows[0])
        for r in rows:
            if r.id != keep.id:
                conn.execute(sa.text("DELETE FROM score WHERE id = :id"), {"id": r.id})


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    have = {c["name"] for c in insp.get_columns("score")}
    for name, type_, default in NEW_SCORE_COLUMNS:
        if name not in have:
            op.add_column("score", sa.Column(name, type_, nullable=False, server_default=default))
    if "day_date" not in have:
        op.add_column("score", sa.Column("day_date", sa.Date(), nullable=True))
    names = {u["name"] for u in insp.get_unique_constraints("score")}
    if OLD_UNIQUE in names:
        op.drop_constraint(OLD_UNIQUE, "score", type_="unique")
    if NEW_UNIQUE not in names:
        op.create_unique_constraint(NEW_UNIQUE, "score", ["user_id", "element_id", "skill"])
    have = {c["name"] for c in insp.get_columns("progress_tracking")}
    for name in NEW_TRACKING_COLUMNS:
        if name not in have:
            op.add_column("progress_tracking", sa.Column(name, sa.String(), nullable=True))
    backfill_skills(bind)


def downgrade() -> None:
    bind = op.get_bind()
    collapse_skills(bind)
    op.drop_constraint(NEW_UNIQUE, "score", type_="unique")
    op.create_unique_constraint(OLD_UNIQUE, "score", ["user_id", "element_id"])
    for name in NEW_TRACKING_COLUMNS:
        op.drop_column("progress_tracking", name)
    for name in ("day_date", "day_gain", "recent", "is_leech", "stability", "skill"):
        op.drop_column("score", name)
