FROM python:3.12-slim-bookworm

RUN --mount=type=cache,target=/var/cache/apt --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless build-essential curl ca-certificates gnupg lsb-release && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && apt-get install -y --no-install-recommends postgresql-client-16

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
COPY wheels/ ./wheels/
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

COPY docker/prefetch_ocr_models.py /tmp/prefetch_ocr_models.py
RUN uv run --frozen --no-dev python /tmp/prefetch_ocr_models.py && rm /tmp/prefetch_ocr_models.py

COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/restore_latest_backup.py docker/migrate.py docker/backup_on_exit.py ./docker/
RUN chmod +x /entrypoint.sh

ENV LAPP_HOST=0.0.0.0

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uv", "run", "--frozen", "--no-dev", "server"]
