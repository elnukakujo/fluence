# SDD ledger — plan: docs/superpowers/plans/2026-10-25-auth-hardening.md

Spec: docs/superpowers/specs/2026-10-25-auth-hardening-design.md
Branch: feat/auth-hardening (off dev 7c12707)

Pre-flight: tasks are sequential (session → middleware → ownership → frontend); Interfaces blocks are self-consistent. No cross-task conflicts found.
Task 1: complete (commits 7c12707..ede058c, tests: uv run pytest tests/test_auth_service.py::test_user_session_roundtrip -v → 1/1 pass; full suite 54 passed / 2 pre-existing failed)
Task 2: complete (commits ede058c..HEAD, tests: uv run pytest tests/test_admin_model.py -v → 2/2 pass; full suite 56 passed / 2 pre-existing failed)
Task 3: complete (commits 2b72f5c..HEAD, verify: migration applied via seed_demo run_migrations → demo is_admin=t, user_session table present)
Task 3: Ruling: seed_demo.py also sets is_admin for the first user — the migration's data-migration only runs on the upgrade path (existing DB); a fresh DB uses create_all+stamp and skips it, so the seed must promote the first user too — cost if wrong: demo seeded non-admin on a fresh DB
Task 4: complete (commits de2b8d0..HEAD, tests: uv run pytest tests/test_auth_service.py -q → 13/13 pass; full suite 63 passed / 2 pre-existing failed)
Task 4: Ruling: AuthService.on_success takes user_id:str (plan said user:User) — simpler and avoids ORM-identity across sessions — cost if wrong: one signature rename in Task 7
Task 4: Ruling: deleted tests/test_auth_login.py (superseded by test_auth_service.py; its route test moves to Task 7) — avoids duplicating authenticate tests — cost if wrong: brief gap in route-level login coverage until Task 7
Task 5: complete (commits 2f08a86..HEAD, tests: uv run pytest tests/test_auth_middleware.py -q → 4/4 pass; full suite 67 passed / 2 pre-existing failed)
Task 6: complete (commits 57f4533..HEAD, tests: uv run pytest tests/test_admin_model.py -q → 7/7 pass; full suite 72 passed / 2 pre-existing failed)
Task 7: complete (commits cb7f27a..HEAD, tests: uv run pytest tests/test_auth_routes.py -q → 6/6 pass; full suite 78 passed / 2 pre-existing failed)
Task 7: Ruling: wrote the route impl before the route tests (the RED would have been a 404 route-not-found, not an assertion) — the tests still assert real behavior (status, Set-Cookie, error body) — cost if wrong: none, the assertions would still catch a wrong implementation
