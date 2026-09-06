# Runbook operativo MVP

Este runbook asume un host Linux con Docker Compose, el archivo no versionado `infrastructure/.env.prod` y los artefactos de `docker-compose.prod.yml`. Nunca pegues secretos en comandos, logs o tickets. Backups y restores reales requieren autorización operativa explícita.

## Variables de scripts

Los scripts aceptan configuración mediante variables de entorno del proceso:

- `ENV_FILE`: env utilizado por Compose; por defecto `infrastructure/.env.prod`.
- `COMPOSE_FILE`: Compose productivo; usa el archivo versionado por defecto.
- `BACKUP_DIR`: destino local; por defecto `infrastructure/backups`.
- `EXTERNAL_COPY_HOOK`: ejecutable opcional para copiar un dump y su checksum a un destino externo.
- `BACKUP_MAX_AGE_HOURS`: antigüedad máxima aceptada por monitoring; 26 por defecto.
- `LOG_SINCE`: ventana de conteo de errores API; `15m` por defecto.

El hook externo recibe dos argumentos: ruta del `.dump` validado y ruta de su `.sha256`. Debe devolver cero solo cuando ambos estén copiados y verificados. El proveedor, credenciales y destino no se definen en el repositorio.

## Deploy

1. Confirma commit/tag, ventana de mantenimiento, espacio en disco, último backup correcto y compatibilidad de migraciones.
2. Valida el env y Compose sin mostrar secretos.
3. Ejecuta un backup autorizado.
4. Ejecuta `sh infrastructure/scripts/deploy.sh` con `ENV_FILE` si no se usa el valor predeterminado.
5. Confirma que migrate termina en cero y que web/API/PostgreSQL quedan healthy.
6. Comprueba HTTPS, SPA, `/api/health`, login tenant/platform, Origin y logs.

Los comandos detallados y el rollback están en [DEPLOYMENT.md](DEPLOYMENT.md).

## Rollback de aplicación

Selecciona el `IMAGE_TAG` inmutable anterior y actualiza únicamente `api` y `web` con `--no-deps`. No reviertas migraciones. Si la imagen anterior no es compatible con el schema actual, aplica un fix forward o sigue un restore autorizado; detén el procedimiento si no existe backup válido.

## Backup

Ejecuta desde una cuenta operativa con permisos sobre Docker y el directorio de backups:

```sh
BACKUP_DIR=/ruta/local/privada \
EXTERNAL_COPY_HOOK=/ruta/al/hook-opcional \
ENV_FILE=/ruta/a/.env.prod \
sh infrastructure/scripts/backup-postgres.sh
```

El script:

- usa `pg_dump` custom con compresión 9;
- crea un nombre UTC `deenova-YYYYMMDDTHHMMSSZ.dump`;
- valida el catálogo con `pg_restore --list`;
- crea y comprueba SHA-256;
- conserva 7 diarios, 4 copias dominicales y 3 copias del primer día del mes;
- ejecuta el hook externo después de validar y aplicar retención;
- usa permisos restrictivos mediante `umask 077`.

Programa el backup diario con systemd timer o cron del host. Captura el exit code y alerta ante cualquier valor distinto de cero. El directorio local y el hook deben estar fuera de rutas públicas y con espacio supervisado.

## Restore seguro

No restaures sobre la base activa. Crea previamente una base vacía y explícita destinada a prueba, por ejemplo mediante una acción operativa autorizada. El script solo acepta `TARGET_ENVIRONMENT=test` o `restore-validation`, rechaza el nombre de la base origen dentro del contenedor y exige confirmación textual.

```sh
DUMP_FILE=/ruta/deenova-YYYYMMDDTHHMMSSZ.dump \
TARGET_DATABASE=deenova_restore_validation \
TARGET_ENVIRONMENT=restore-validation \
RESTORE_CONFIRMATION=RESTORE_TO_deenova_restore_validation \
ENV_FILE=/ruta/a/.env.prod \
sh infrastructure/scripts/restore-postgres.sh
```

Antes de restaurar valida checksum y catálogo. Después verifica:

1. `pg_restore` terminó en cero.
2. Tablas y las tres migraciones esperadas existen.
3. Counts básicos son coherentes con el origen del backup.
4. La aplicación, apuntada temporalmente a la DB restaurada, devuelve health 200.
5. Login y una lectura tenant no destructiva funcionan sin crossover.
6. Registra duración, tamaño, fecha y resultado del ejercicio sin datos personales.
7. Elimina la DB de prueba solo mediante un cambio separado y autorizado; este repositorio no incluye un comando de borrado.

## Monitoring MVP

Ejecuta periódicamente:

```sh
BACKUP_DIR=/ruta/local/privada \
ENV_FILE=/ruta/a/.env.prod \
sh infrastructure/scripts/check-monitoring.sh
```

El check devuelve non-zero ante health fallido, falta de contenedores, backup ausente/antiguo o checksum inválido. Informa:

- estado, health y restart count de contenedores;
- snapshot de CPU/RAM con `docker stats --no-stream`;
- espacio del filesystem de backups;
- health API/DB mediante `/api/health`;
- health web interno;
- `pg_isready` de PostgreSQL;
- conteo de indicadores ERROR/5xx del backend sin imprimir líneas potencialmente sensibles;
- edad y checksum del último backup diario.

El canal/proveedor externo de alertas permanece pendiente. Hasta elegirlo, cron/systemd debe conservar el exit code y stdout/stderr en un destino restringido.

## Revisión de logs

Compose usa `json-file` con máximo 10 MiB y cinco archivos por contenedor. La aplicación escribe a stdout/stderr. Revisa conteos y contexto mínimo de 5xx, 401/403/429 y restart loops, evitando copiar PII o cabeceras completas. Nunca registres passwords, JWT, cookies, secretos o URLs con credenciales.

## Incidentes

### DB down

1. Revisa `docker compose ps`, health y espacio de disco.
2. Consulta logs PostgreSQL con acceso restringido.
3. No borres el volumen ni ejecutes `down -v`.
4. Si existe corrupción o pérdida, detén escrituras y escala a restore autorizado.

### App/API down

1. Comprueba web, API y PostgreSQL por separado.
2. Revisa restart count, exit code y últimos errores.
3. Si el release causó el fallo, ejecuta rollback de aplicación.
4. No repitas migraciones destructivas ni alteres secretos durante el diagnóstico.

### Disco lleno

1. Detén despliegues y backups nuevos.
2. Identifica consumo en volumen DB, backups, imágenes y logs.
3. No borres el volumen PostgreSQL.
4. Libera solo imágenes sin uso y backups que excedan retención después de confirmar copia externa.
5. Amplía almacenamiento si el margen sigue siendo insuficiente.

### Backup failure

1. Conserva el último backup válido.
2. Revisa espacio, permisos, health DB, checksum y hook externo.
3. Corrige la causa y repite el backup; no reduzcas retención para ocultar el fallo.
4. Escala si se supera el RPO acordado.

### Restart loop

1. Revisa `RestartCount`, exit code y logs previos al reinicio.
2. Valida env, conectividad DB y estado de migraciones.
3. Detén el servicio afectado si el loop agrava carga o logs.
4. Haz rollback de la aplicación si el cambio reciente es la causa.

### Certificado/TLS

1. Comprueba DNS, puertos 80/443, hora del host y acceso saliente ACME.
2. Revisa logs Caddy sin publicar datos de cuenta.
3. No elimines `caddy_data` durante la incidencia.
4. Renueva/reintenta solo después de resolver DNS/firewall para evitar rate limits ACME.

## Checklist antes de producción

- VPS/SO parcheado, DNS, firewall y SSH restringidos.
- Secretos aleatorios en mecanismo no versionado.
- HTTPS válido y cookies `Secure`.
- API/DB sin puertos públicos.
- `trust proxy` coincide con la topología real.
- Migraciones revisadas y backup previo validado.
- Restore drill satisfactorio y RPO/RTO acordados.
- Espacio y retención comprobados.
- Monitoring programado y canal de alertas definido.
- Rotación y acceso a logs verificados.
- Smoke auth, tenancy, platform, suspensión y health aprobado.
- F11/WhatsApp y billing continúan fuera de alcance.
