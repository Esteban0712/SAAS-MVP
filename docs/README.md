# Documentación

## Decisiones de autenticación y autorización

- Las identidades USER y PLATFORM usan endpoints de login separados.
- USER incluye un `businessId`; PLATFORM nunca pertenece a un tenant.
- `AuthenticatedPrincipal` es la única fuente del tenant efectivo.
- `AuthGuard` verifica el JWT HttpOnly y reconstruye el principal desde PostgreSQL.
- `TenantGuard` y `PlatformGuard` separan las superficies de acceso.
- `PermissionsGuard` consulta los permisos actuales reconstruidos desde Role/Permission.
- Los controllers son delgados y los services aplican los filtros Prisma por tenant.

## Estrategia web

El frontend usa `credentials: include` en el cliente central y TanStack Query sobre `GET /api/auth/me` como fuente de sesión. No persiste JWT en `localStorage`, `sessionStorage` ni IndexedDB. Las rutas `/app/*` y `/employee/*` requieren USER; `/platform/*` requiere PLATFORM.

La ocultación de navegación se considera únicamente UX. El backend continúa siendo la autoridad de seguridad.

## Validación de Fase 6

Las suites cubren login, cookie HttpOnly, logout, actores inactivos, permisos dinámicos, separación USER/PLATFORM, manipulación de `businessId`, aislamiento A/B, 404 cross-tenant y gestión de Users/Roles/Permissions.

Los comandos completos están documentados en los README de backend y frontend.
