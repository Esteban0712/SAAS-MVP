# Despliegue con Docker Compose

Esta configuración empaqueta el MVP para staging o producción en un único host. No crea VPS, DNS, firewall, backups ni monitoring. Esos elementos deben existir antes de un despliegue real.

## Arquitectura

- `web`: Caddy sirve el build React, aplica fallback SPA y envía `/api/*` a `api:3000`. Es el único servicio con puertos publicados (`80`, `443` y `443/udp`).
- `api`: NestJS non-root, sin puerto publicado. Comparte la red `edge` con Caddy y la red interna `data` con PostgreSQL.
- `postgres`: PostgreSQL 16 con volumen persistente y únicamente en la red interna `data`.
- `migrate`: proceso one-shot con Prisma CLI. Ejecuta `prisma migrate deploy` y termina; nunca ejecuta `migrate dev`, `db push` o reset.

Frontend y API usan el mismo origen público. El frontend se compila con `VITE_API_URL=/api`; `FRONTEND_URL` debe ser exactamente `https://<APP_HOST>`. Caddy gestiona certificados ACME y redirección HTTPS.

## Prerrequisitos

- Docker Engine y Docker Compose actuales.
- Host Linux con puertos 80/443 disponibles.
- DNS de `APP_HOST` apuntando al host.
- Acceso saliente para ACME y descarga/build de imágenes.
- Firewall que publique solo 80/443 y el SSH administrado.
- Secretos aleatorios propios del entorno.

No uses los placeholders del template como valores reales.

## Configuración

1. Copia `infrastructure/.env.prod.example` como `infrastructure/.env.prod`.
2. Define un `IMAGE_TAG` inmutable, idealmente el hash completo del commit.
3. Sustituye todos los placeholders.
4. Genera `JWT_SECRET` y `POSTGRES_PASSWORD` aleatorios; no los guardes en Git, logs, historial del shell ni tickets.
5. Codifica usuario/password de `DATABASE_URL` como URL cuando contengan caracteres reservados.
6. Mantén `TRUST_PROXY_HOPS=1` para la topología Caddy → API incluida. No aumentes el valor sin añadir proxies controlados.

Valida sin construir ni arrancar:

```sh
docker compose \
  --env-file infrastructure/.env.prod \
  -f infrastructure/docker-compose.prod.yml \
  config --quiet
```

## Deploy

El script valida Compose, construye las tres imágenes, arranca PostgreSQL, ejecuta la migración one-shot y solo entonces actualiza API y web:

```sh
ENV_FILE=./infrastructure/.env.prod \
  sh infrastructure/scripts/deploy.sh
```

`prisma migrate deploy` aplica únicamente migraciones versionadas. Un fallo detiene el script antes de actualizar la aplicación. El servicio `migrate` tiene perfil `tools` para que un `docker compose up` accidental no lo ejecute.

Después del deploy verifica:

```sh
docker compose --env-file infrastructure/.env.prod \
  -f infrastructure/docker-compose.prod.yml ps
curl --fail https://<APP_HOST>/
curl --fail https://<APP_HOST>/api/health
```

También deben comprobarse login tenant/platform, cookies `Secure`, Origin permitido/rechazado, aislamiento tenant y logs sin secretos.

## Rollback de aplicación

Conserva las imágenes del release anterior. Para volver atrás, cambia `IMAGE_TAG` al tag anterior y actualiza solo aplicación:

```sh
docker compose --env-file infrastructure/.env.prod \
  -f infrastructure/docker-compose.prod.yml up -d --wait --no-deps api web
```

Este rollback no revierte la base de datos. Las migraciones son forward-only: la imagen anterior solo puede restaurarse si sigue siendo compatible con el schema desplegado. Si no lo es, aplica un fix forward o sigue el procedimiento de restore que se definirá en Bloque C. Nunca edites migraciones aplicadas ni improvises una down migration.

## Operación y seguridad

- Los contenedores API y migrate ejecutan como usuario `node`; Caddy usa la seguridad de su imagen oficial.
- API y PostgreSQL no publican puertos al host.
- Caddy conserva certificados y estado en volúmenes separados.
- PostgreSQL usa un volumen nombrado, que no sustituye un backup.
- Los healthchecks controlan PostgreSQL, `/api/health` y el listener interno de Caddy.
- Nest recibe un único proxy confiable. Caddy establece la cadena de forwarding; la API no debe exponerse directamente.
- `SIGTERM`, `init: true` y `stop_grace_period` permiten que Nest cierre conexiones y Prisma se desconecte.
- Los logs van a stdout/stderr. No deben contener passwords, JWT, cookies, secretos ni PII sin redacción.

Los procedimientos de backup, restore y monitoring MVP están en [RUNBOOK.md](RUNBOOK.md). El destino externo y el canal de alertas requieren proveedor real. Despliegue real, VPS, DNS, SSH y firewall permanecen fuera de este bloque.
