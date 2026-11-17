"""Static guards for the platform layer (spec 4, Part D): the routes must not leak internals or trust raw bodies."""
import re
from pathlib import Path

ROUTES = sorted((Path(__file__).resolve().parents[1] / "src" / "lapp" / "api" / "routes").glob("*.py"))


def test_no_route_returns_exception_text_from_a_catch_all():
    """`except Exception as e:` that answers `str(e)` leaks SQL, paths and keys; log it and answer a generic message."""
    offenders = []
    for path in ROUTES:
        lines = path.read_text().splitlines()
        for i, line in enumerate(lines):
            m = re.search(r"except Exception as (\w+):", line)
            block = "\n".join(lines[i + 1:i + 8])
            if m and f"str({m.group(1)})" in block and "jsonify" in block:
                offenders.append(f"{path.name}:{i + 1}")
    assert offenders == []


def test_no_direct_indexing_of_the_request_body():
    offenders = [p.name for p in ROUTES if re.search(r"request\.(json|get_json\(\))\[", p.read_text())]
    assert offenders == []


def test_bodies_are_validated_through_parse_json():
    """`Dict(**request.json)` turns a missing body into a 500; `parse_json(Dict)` answers 400 with the field errors."""
    offenders = [p.name for p in ROUTES if re.search(r"\w+Dict\(\*\*(\(?request\.(json|get_json\(\))( or \{\})?\)?)\)", p.read_text())]
    assert offenders == []
