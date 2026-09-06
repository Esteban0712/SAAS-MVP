#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INFRA_DIR=$(dirname "$SCRIPT_DIR")
COMPOSE_FILE=${COMPOSE_FILE:-"$INFRA_DIR/docker-compose.prod.yml"}
ENV_FILE=${ENV_FILE:-"$INFRA_DIR/.env.prod"}
BACKUP_DIR=${BACKUP_DIR:-"$INFRA_DIR/backups"}
BACKUP_MAX_AGE_HOURS=${BACKUP_MAX_AGE_HOURS:-26}
LOG_SINCE=${LOG_SINCE:-15m}
status=0

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

[ -f "$ENV_FILE" ] || { log "ERROR: environment file not found" >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log "Container state"
compose ps || status=1

container_ids=$(compose ps -q)
if [ -n "$container_ids" ]; then
  docker inspect --format '{{.Name}} restart-count={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $container_ids || status=1
  log "Container CPU and memory snapshot"
  docker stats --no-stream $container_ids || status=1
else
  log "ERROR: no running project containers found" >&2
  status=1
fi

if compose exec -T api node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
  log "API and database health: ok"
else
  log "ERROR: API health failed" >&2
  status=1
fi

if compose exec -T web wget -q --spider http://127.0.0.1:8080/healthz; then
  log "Web health: ok"
else
  log "ERROR: web health failed" >&2
  status=1
fi

if compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /dev/null; then
  log "PostgreSQL health: ok"
else
  log "ERROR: PostgreSQL health failed" >&2
  status=1
fi

log "Filesystem usage"
df -h "$BACKUP_DIR" || status=1

error_count=$(compose logs --since "$LOG_SINCE" api 2>&1 | grep -Ec 'ERROR|statusCode[": ]+5[0-9][0-9]' || true)
log "Backend error indicators in last $LOG_SINCE: $error_count"

latest=$(find "$BACKUP_DIR/daily" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2- || true)
if [ -z "$latest" ]; then
  log "ERROR: no daily backup found" >&2
  status=1
else
  now=$(date +%s)
  modified=$(stat -c %Y "$latest")
  age_hours=$(((now - modified) / 3600))
  log "Newest backup age: ${age_hours}h"
  if [ "$age_hours" -gt "$BACKUP_MAX_AGE_HOURS" ]; then
    log "ERROR: newest backup exceeds ${BACKUP_MAX_AGE_HOURS}h" >&2
    status=1
  fi
  if ! (cd "$(dirname "$latest")" && sha256sum --check "$(basename "$latest.sha256")" > /dev/null 2>&1); then
    log "ERROR: newest backup checksum failed" >&2
    status=1
  fi
fi

exit "$status"
