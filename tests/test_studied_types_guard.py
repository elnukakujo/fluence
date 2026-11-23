"""SG-14: a surface that lists, counts, queues, generates or parses a language's feature types must ask `studied_types`.
Every file that mentions Vocabulary / Grammar / Calligraphy is either MUST_FILTER (and imports the lookup) or ALLOWED with the reason it needs no filter.
A new file that mentions them fails here until it is put in one of the two."""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "lapp"
MENTION = re.compile(r"\b(Vocabulary|Grammar|Calligraphy)\b")

MUST_FILTER = {
    "services/features/study_goal.py": "the week menu",
    "services/features/review_queue.py": "the custom review's type scope",
    "services/data_collection/home_stats.py": "Type tab stats, headline, due counts",
    "services/containers/lesson.py": "lesson score aggregate",
    "services/data_collection/weekly_snapshot.py": "new snapshots follow the setting",
    "services/search.py": "search results",
    "services/exercise_generation/pool.py": "generator pool: no slots or companions of a disabled type",
    "services/ingestion/jobs.py": "parser: no card of a disabled type",
    "api/routes/ingestion.py": "parser: no card of a disabled type",
    "tasks/text_gen.py": "background text generation skips a disabled type",
}
ALLOWED = {
    "api/routes/calligraphy.py": "one element by id: a direct link still opens (rule 5)",
    "api/routes/grammar.py": "one element by id",
    "api/routes/vocabulary.py": "one element by id",
    "core/database.py": "infrastructure",
    "services/features/calligraphy.py": "per-type service (create/update/delete)",
    "services/features/grammar.py": "per-type service",
    "services/features/vocabulary.py": "per-type service",
    "services/features/exercise.py": "exercise service: links are stored, filtered when read by the routes",
    "services/evaluator.py": "scores one answer",
    "services/features/card_time.py": "time estimate for cards of an already filtered queue",
    "services/ingestion/elements.py": "builds elements of kinds the jobs already filtered",
    "services/ingestion/grammar.py": "builds a grammar the jobs already filtered",
    "services/system_data/change_log.py": "history of what was done",
    "services/system_data/collaboration.py": "copies and shares data as it is",
    "tasks/media_cleanup.py": "files of all data, studied or not",
    "utils/element_kinds.py": "id prefix lookup",
    "utils/resolve_orm_table.py": "table lookup",
}


def test_every_surface_that_touches_feature_types_filters_or_says_why_not():
    unlisted, unfiltered = [], []
    for p in SRC.rglob("*.py"):
        rel = p.relative_to(SRC).as_posix()
        if any(x in rel for x in ("graphify", "models/", "schemas/", "migrations")) or not MENTION.search(p.read_text()):
            continue
        if rel in MUST_FILTER:
            if "studied_types" not in p.read_text():
                unfiltered.append(f"{rel} ({MUST_FILTER[rel]})")
        elif rel not in ALLOWED:
            unlisted.append(rel)
    assert unlisted == [], f"new files touching feature types: list them in MUST_FILTER or ALLOWED: {unlisted}"
    assert unfiltered == [], f"these surfaces do not use studied_types yet: {unfiltered}"
