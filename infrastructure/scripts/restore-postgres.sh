#!/usr/bin/env sh
set -eu

umask 077

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INFRA_DIR=$(dirname "$SCRIPT_DIR")
COMPOSE_FILE=${COMPOSE_FILE:-"$INFRA_DIR/docker-compose.prod.yml"}
ENV_FILE=${ENV_FILE:-"$INFRA_DIR/.env.prod"}
DUMP_FILE=${DUMP_FILE:-}
TARGET_DATABASE=${TARGET_DATABASE:-}
TARGET_ENVIRONMENT=${TARGET_ENVIRONMENT:-}
RESTORE_CONFIRMATION=${RESTORE_CONFIRMATION:-}

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

[ -f "$ENV_FILE" ] || fail "environment file not found: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || fail "Compose file not found: $COMPOSE_FILE"
[ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ] || fail "DUMP_FILE must identify an existing dump"
[ -n "$TARGET_DATABASE" ] || fail "TARGET_DATABASE is required"
case "$TARGET_DATABASE" in
  *[!A-Za-z0-9_-]*) fail "TARGET_DATABASE contains unsupported characters" ;;
esac
target_lower=$(printf '%s' "$TARGET_DATABASE" | tr '[:upper:]' '[:lower:]')
case "$target_lower" in
  *prod*) fail "TARGET_DATABASE must not contain prod" ;;
  *_test|*_restore|*_restore_validation) ;;
  *) fail "TARGET_DATABASE must end in _test, _restore, or _restore_validation" ;;
esac
case "$TARGET_ENVIRONMENT" in
  test|restore-validation) ;;
  *) fail "TARGET_ENVIRONMENT must be test or restore-validation; production restore is refused" ;;
esac
[ "$RESTORE_CONFIRMATION" = "RESTORE_TO_$TARGET_DATABASE" ] || \
  fail "RESTORE_CONFIRMATION must exactly match RESTORE_TO_<TARGET_DATABASE>"

checksum="$DUMP_FILE.sha256"
[ -f "$checksum" ] || fail "checksum file not found: $checksum"
(
  cd "$(dirname "$DUMP_FILE")"
  sha256sum --check "$(basename "$checksum")" > /dev/null
) || fail "checksum validation failed"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose exec -T postgres pg_restore --list < "$DUMP_FILE" > /dev/null || \
  fail "pg_restore could not read the dump catalog"

log "Dump validated; restoring only to explicit test database: $TARGET_DATABASE"
compose exec -T postgres sh -c \
  'if [ "$1" = "$POSTGRES_DB" ]; then echo "refusing source database overwrite" >&2; exit 2; fi' \
  sh "$TARGET_DATABASE"
compose exec -T postgres sh -c \
  'pg_restore --username "$POSTGRES_USER" --dbname "$1" --clean --if-exists --no-owner --no-privileges --exit-on-error' \
  sh "$TARGET_DATABASE" < "$DUMP_FILE"
log "Restore completed; perform the documented post-restore verification"
