#!/usr/bin/env bash
set -e

docker compose build --no-cache
docker compose up --abort-on-container-exit --exit-code-from tests
EXIT_CODE=$?
docker compose down -v || true
exit $EXIT_CODE