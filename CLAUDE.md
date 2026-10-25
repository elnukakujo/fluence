# Fluence

Full-stack, multi-user language-learning platform: Flask API, Next.js client, per-user configurable
LLM backends. Organizes vocabulary, grammar, calligraphy, characters, words, passages, and
exercises under a Language → Lesson → Elements hierarchy.

## Where things live

- Architecture, key files, env vars, migrations: `docs/ARCHITECTURE.md`
- Domain knowledge (data model, exercises, review/scoring, AI, study tracking): `docs/domain/`
- Operational rules (docs hygiene, git workflow): `docs/rules/`
- Skills (graphify, ponytail, superpowers, ui-ux-pro-max): `docs/skills/`
- Session history: `docs/logs/CHANGELOG.md`, then `docs/logs/sessions/`

## Before Starting Any Task

1. Check `docs/logs/CHANGELOG.md`, then the relevant `docs/logs/sessions/` file.
2. Structural questions → query the graph (`/graphify query`, `path`, `explain`); never grep or
   spawn a sub-agent for this.
3. Any doubt (domain, behaviour, naming, "is this intended?") → check `docs/` (domain pages, rules,
   logs) before guessing or asking.
4. Domain questions → `docs/domain/` before asking the user.

## After Modifying Code

Run `/graphify --update <changed paths>` before ending the turn — every turn, no exceptions.

## Non-Negotiable Rules

- Never push directly to `main` or `test` — work on `dev` or a feature branch (see `docs/rules/git-workflow.md`).
- All DB access goes through `db_manager`; service methods use `@transactional` and pass `commit=False`.
- IDs come from `db_manager.generate_new_id()` — never hand-rolled.
- Score/difficulty updates go through `update_score` / `update_difficulty` in `src/lapp/utils/helpers.py`.
- LLM calls (text gen, TTS, feedback) go through `src/lapp/utils/model_api.py` — never direct.
- New models go in the right `models/<bucket>/` and its `__init__.py` — the import order in
  `models/__init__.py` is load-bearing.
- Never invent domain logic or scoring thresholds — leave a `TODO` and ask.
- Never spawn a sub-agent for structural exploration — use `/graphify`.
