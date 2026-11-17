"""Every route must answer 401 to an anonymous caller unless it is on the allow-list (tests/auth_allowlist.py)."""
import re

import pytest

from auth_allowlist import AUTH_OPEN, SKIP_PREFIXES


def _fill(rule: str) -> str:
    rule = re.sub(r"<int:[^>]+>", "1", rule)
    return re.sub(r"<(?:[^:>]+:)?[^>]+>", "x", rule)


def test_every_route_requires_a_session(app, db):
    client = app.test_client()
    open_routes = []
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith(SKIP_PREFIXES):
            continue
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            if (rule.rule, method) in AUTH_OPEN:
                continue
            status = client.open(_fill(rule.rule), method=method).status_code
            if status != 401:
                open_routes.append(f"{method} {rule.rule} -> {status}")
    assert not open_routes, "routes reachable without a session:\n" + "\n".join(open_routes)
