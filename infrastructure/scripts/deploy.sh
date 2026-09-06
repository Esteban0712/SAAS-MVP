#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INFRA_DIR=$(dirname "$SCRIPT_DIR")
COMPOSE_FILE=${COMPOSE_FILE:-"$INFRA_DIR/docker-compose.prod.yml"}
ENV_FILE=${ENV_FILE:-"$INFRA_DIR/.env.prod"}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose config --quiet
compose --profile tools build migrate api web
compose up -d --wait postgres
compose --profile tools run --rm migrate
compose up -d --wait api web
compose ps
