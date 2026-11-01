#!/bin/sh
# Deploy Fluence with Docker Compose.
# Run on PCT after `git pull`.
set -e
cd "$(dirname "$0")"

git pull --ff-only
# Build one image at a time: parallel backend+frontend builds peak at ~all of the VM RAM.
docker compose build backend
docker compose build frontend
docker compose up -d --remove-orphans
docker builder prune -af
docker image prune -f
