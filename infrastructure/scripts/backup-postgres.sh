#!/usr/bin/env sh
set -eu

umask 077
export LC_ALL=C

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INFRA_DIR=$(dirname "$SCRIPT_DIR")
COMPOSE_FILE=${COMPOSE_FILE:-"$INFRA_DIR/docker-compose.prod.yml"}
ENV_FILE=${ENV_FILE:-"$INFRA_DIR/.env.prod"}
BACKUP_DIR=${BACKUP_DIR:-"$INFRA_DIR/backups"}
EXTERNAL_COPY_HOOK=${EXTERNAL_COPY_HOOK:-}

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

[ -f "$ENV_FILE" ] || fail "environment file not found: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || fail "Compose file not found: $COMPOSE_FILE"
[ "$BACKUP_DIR" != "/" ] || fail "BACKUP_DIR must not be the filesystem root"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

prune_tier() {
  tier_dir=$1
  keep=$2
  set -- "$tier_dir"/*.dump
  [ -e "$1" ] || return 0
  count=$#
  while [ "$count" -gt "$keep" ]; do
    oldest=$1
    rm -f -- "$oldest" "$oldest.sha256"
    shift
    count=$((count - 1))
  done
}

timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
daily_dir="$BACKUP_DIR/daily"
weekly_dir="$BACKUP_DIR/weekly"
monthly_dir="$BACKUP_DIR/monthly"
mkdir -p "$daily_dir" "$weekly_dir" "$monthly_dir"

dump="$daily_dir/deenova-$timestamp.dump"
temporary="$dump.partial"
checksum="$dump.sha256"
trap 'rm -f -- "$temporary"' EXIT HUP INT TERM

log "Starting PostgreSQL backup"
compose exec -T postgres sh -c \
  'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom --compress=9 --no-owner --no-privileges' \
  > "$temporary"
[ -s "$temporary" ] || fail "pg_dump produced an empty file"

compose exec -T postgres pg_restore --list < "$temporary" > /dev/null
mv -- "$temporary" "$dump"
(
  cd "$daily_dir"
  sha256sum "$(basename "$dump")" > "$(basename "$checksum")"
)
(
  cd "$daily_dir"
  sha256sum --check "$(basename "$checksum")" > /dev/null
)
log "Backup validated: $dump"

day_of_week=$(date -u '+%u')
day_of_month=$(date -u '+%d')
if [ "$day_of_week" = "7" ]; then
  weekly="$weekly_dir/$(basename "$dump")"
  cp -p -- "$dump" "$weekly"
  cp -p -- "$checksum" "$weekly.sha256"
  log "Weekly retention copy created"
fi
if [ "$day_of_month" = "01" ]; then
  monthly="$monthly_dir/$(basename "$dump")"
  cp -p -- "$dump" "$monthly"
  cp -p -- "$checksum" "$monthly.sha256"
  log "Monthly retention copy created"
fi

prune_tier "$daily_dir" 7
prune_tier "$weekly_dir" 4
prune_tier "$monthly_dir" 3
log "Retention applied: 7 daily, 4 weekly, 3 monthly"

if [ -n "$EXTERNAL_COPY_HOOK" ]; then
  [ -x "$EXTERNAL_COPY_HOOK" ] || fail "external copy hook is not executable"
  log "Running configured external copy hook"
  "$EXTERNAL_COPY_HOOK" "$dump" "$checksum"
  log "External copy hook completed"
else
  log "External copy hook not configured; backup remains local"
fi

trap - EXIT HUP INT TERM
log "Backup completed successfully"
