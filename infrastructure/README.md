# Infraestructura local

Este directorio contiene PostgreSQL para el desarrollo local de Deenova MVP mediante Docker Compose.

## PostgreSQL

- Servicio de Compose: `postgres`.
- Imagen: `postgres:16`.
- Base de datos: `deenova_dev`.
- Usuario: `deenova`.
- Puerto local: `127.0.0.1:5432`; PostgreSQL no se publica en interfaces externas.
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

## Requisitos para producción

Este Compose es exclusivamente local y no debe utilizarse como despliegue productivo. En producción:

- usa `NODE_ENV=production`, un `JWT_SECRET` aleatorio de al menos 32 caracteres y un `FRONTEND_URL` HTTPS que sea exactamente el origen público permitido;
- termina TLS/HTTPS en un reverse proxy mantenido y conserva cookies `Secure`, `HttpOnly` y `SameSite`;
- configura CORS para un origen concreto, nunca `*` cuando se envían credenciales;
- configura `trust proxy` solo con el número o lista de proxies realmente controlados antes de confiar en IPs reenviadas para rate limiting;
- mantén PostgreSQL en red privada, sin publicar su puerto a Internet, y entrega credenciales mediante el gestor de secretos del entorno;
- ejecuta `prisma migrate deploy` como paso controlado de release, nunca `prisma migrate dev`;
- supervisa los healthchecks de API y base de datos sin devolver detalles internos;
- centraliza logs con control de acceso y redacción de passwords, JWT, cookies, secretos y PII.

El reverse proxy debe limitar también tamaños y tiempos de request, preservar `Origin` y establecer correctamente los headers de forwarding. Su configuración no forma parte de este bloque.
