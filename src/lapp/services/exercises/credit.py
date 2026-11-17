"""Per-element exercise credit: one update per (element, skill) from the average quality of its results (DM-57)."""
from collections import defaultdict
from statistics import mean


def group_results(results: list[dict]) -> dict[tuple[str, str], tuple[float, str]]:
    """{(element_id, skill): (mean quality, evidence of the first result)} for a list of `{element_id, quality, skill, evidence_type}`."""
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in results:
        groups[(r["element_id"], r["skill"])].append(r)
    return {key: (mean(r["quality"] for r in rs), rs[0]["evidence_type"]) for key, rs in groups.items()}
