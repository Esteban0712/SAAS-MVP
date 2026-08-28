# Infraestructura local

Este directorio contiene PostgreSQL para el desarrollo local de Deenova MVP mediante Docker Compose.

## PostgreSQL

- Servicio de Compose: `postgres`.
- Imagen: `postgres:16`.
- Base de datos: `deenova_dev`.
- Usuario: `deenova`.
- Puerto local: `5432`.
- Volumen nombrado: `postgres_data`.

La contraseña declarada en `docker-compose.yml` es exclusiva para desarrollo local y no debe reutilizarse en otros entornos.

El volumen proporciona persistencia local entre reinicios y recreaciones del contenedor, pero no constituye un backup.

## Uso

Ejecuta los comandos desde `infrastructure/`:

```bash
docker compose up -d
docker compose ps
docker compose logs postgres
docker compose stop
docker compose down
```

`docker compose down` elimina los contenedores y la red, pero conserva el volumen nombrado.

> **Advertencia:** `docker compose down -v` elimina el volumen y todos sus datos. No debe utilizarse como flujo normal de desarrollo.
