#!/bin/sh
# Deploy Fluence with Docker Compose.
# Run on PCT after `git pull`.
set -e
cd "$(dirname "$0")"

git pull --ff-only
docker compose up -d --build --remove-orphans
docker builder prune -af
docker image prune -f
