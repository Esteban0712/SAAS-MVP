# Seguridad y preparación de staging

## Modelo de autenticación y sesión

Tenant `User` y `PlatformUser` son identidades separadas. El login emite un JWT únicamente en una cookie `HttpOnly`, `SameSite=Lax`, limitada a `/api`; en producción también es `Secure`. La duración de la cookie deriva de `JWT_EXPIRES_IN` y coincide con la expiración del token. El frontend usa `credentials: include`, no recibe el JWT ni lo persiste en `localStorage`, `sessionStorage` o IndexedDB.

Cada request autenticado reconstruye el principal desde PostgreSQL. Usuario, rol, permisos y Business se comprueban de nuevo. Un Business suspendido invalida inmediatamente el acceso tenant existente y recupera acceso al ser reactivado. `TenantGuard` y `PlatformGuard` impiden convertir o cruzar ambos tipos de actor.

Logout elimina la cookie con los mismos atributos usados al crearla. El frontend vacía siempre toda la caché local, incluso si falla la request, y también la limpia antes de almacenar una identidad recién autenticada.

## Controles HTTP

- CORS admite credenciales solo desde el origen exacto configurado en `FRONTEND_URL`.
- Toda mutación exige un header `Origin` con esa misma coincidencia exacta.
- Los logins tenant y platform tienen rate limiting en memoria por IP y ruta, con `429` y `Retry-After`. Los valores predeterminados son 10 intentos por 60 segundos.
- JSON se limita a 256 KiB. Formularios URL encoded se limitan a 64 KiB y 100 parámetros. Un exceso devuelve `413` saneado.
- Se envían headers mínimos contra sniffing, framing, referrer leakage, acceso a sensores y aislamiento cross-origin. HSTS se activa solo en producción. CSP se deja para el reverse proxy o una fase que pueda validarla contra el frontend real.
- Los errores 500, fallos Prisma conocidos y errores de parser no exponen stack traces, SQL, credenciales ni detalles internos. Los logs no deben contener passwords, JWT, cookies, secretos o PII sin redacción.

## Aislamiento de datos

`businessId` procede exclusivamente del principal autenticado; nunca de body, query, headers o IDs enviados por el cliente. Controllers y services validan relaciones anidadas dentro del mismo tenant. Los IDs ajenos responden 404. Roles y permisos tenant, customers, employees, services, schedules, appointments, sales, payments y receipts conservan este criterio. La superficie `/api/platform/*` es exclusiva de `PlatformUser`.

Las garantías críticas de concurrencia permanecen en PostgreSQL y en transacciones Prisma: exclusión de citas solapadas, una sola sucesora por reprogramación, una venta activa por cita, un recibo por venta y lock de venta antes de aceptar pagos. Un pago completado que exceda el saldo pendiente se rechaza dentro de ese lock.

## Configuración y staging

Antes de staging se requiere:

- `NODE_ENV=production`;
- `JWT_SECRET` aleatorio de al menos 32 caracteres, entregado por un gestor de secretos;
- `FRONTEND_URL` como origen HTTPS exacto, sin path, query, credenciales ni wildcard;
- reverse proxy HTTPS mantenido, con límites de tamaño/tiempo y forwarding headers correctos;
- configurar `trust proxy` solo para proxies controlados antes de confiar en la IP reenviada;
- PostgreSQL privado, no publicado a Internet, con backup, TLS y credenciales independientes;
- aplicar migraciones existentes mediante `prisma migrate deploy`;
- healthchecks de API y DB monitorizados sin exponer detalles internos;
- logs centralizados con acceso restringido, retención definida y redacción de secretos/PII;
- ejecutar lint, build, unit, e2e, audits, Prisma validate/generate/status y smoke de seguridad contra la configuración candidata.

Los `.env` reales no se versionan. Los ejemplos solo enumeran claves y valores locales no secretos. El Compose incluido es exclusivamente de desarrollo y publica PostgreSQL únicamente en `127.0.0.1`.

## Cobertura de seguridad

Las suites unit/e2e cubren credenciales incorrectas; token ausente, inválido y expirado; logout; rate limit y recuperación; Origin permitido/rechazado; headers y payload excesivo; validación de configuración; aislamiento tenant y Platform/Tenant; Business suspendido; permisos dinámicos; relaciones cross-tenant; validación DTO; horarios, timezone y fechas; concurrencia de citas/reprogramaciones/pagos; atomicidad de alta de Business; ventas, pagos y recibos.

## Riesgos aceptados y trabajo diferido

- Advisories de tooling en Prisma 7 (`prisma`, `@prisma/config`, `deepmerge-ts` y `mysql2`) sin fix 7.x estable y seguro. No se acepta el downgrade automático a Prisma 6 ni una versión 8 RC.
- Enforcement de `mustChangePassword`: requiere un flujo completo de cambio de contraseña en API y UI.
- Revocación server-side de JWT: no existe todavía lista de revocación ni rotación de sesión.
- Idempotency key persistente para pagos: el sobrepago concurrente está protegido, pero el replay exacto seguirá pendiente hasta una migración futura.
- Rate limiter multi-instance: el contador actual es por proceso y no comparte estado entre réplicas.
- F11/WhatsApp y billing permanecen intactos y diferidos. F14, despliegue y VPS también quedan fuera de Fase 13.
