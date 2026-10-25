# SDD ledger — plan: docs/superpowers/plans/2026-10-25-auth-hardening.md

Spec: docs/superpowers/specs/2026-10-25-auth-hardening-design.md
Branch: feat/auth-hardening (off dev 7c12707)

Pre-flight: tasks are sequential (session → middleware → ownership → frontend); Interfaces blocks are self-consistent. No cross-task conflicts found.
Task 1: complete (commits 7c12707..ede058c, tests: uv run pytest tests/test_auth_service.py::test_user_session_roundtrip -v → 1/1 pass; full suite 54 passed / 2 pre-existing failed)
Task 2: complete (commits ede058c..HEAD, tests: uv run pytest tests/test_admin_model.py -v → 2/2 pass; full suite 56 passed / 2 pre-existing failed)
Task 3: complete (commits 2b72f5c..HEAD, verify: migration applied via seed_demo run_migrations → demo is_admin=t, user_session table present)
Task 3: Ruling: seed_demo.py also sets is_admin for the first user — the migration's data-migration only runs on the upgrade path (existing DB); a fresh DB uses create_all+stamp and skips it, so the seed must promote the first user too — cost if wrong: demo seeded non-admin on a fresh DB
