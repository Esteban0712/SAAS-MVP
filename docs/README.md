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

## Fase 7 — Customers

Customers es el primer CRUD funcional tenant-scoped. El backend aplica `customers.view` a list/detail y `customers.manage` a create/update. Todas las consultas Prisma incluyen el `businessId` reconstruido desde el principal; los IDs ajenos responden 404 y valores manipulados por el cliente no seleccionan tenant.

El API expone `GET/POST /api/customers` y `GET/PATCH /api/customers/:id`, sin DELETE. El listado busca por nombre, teléfono y email, pagina con metadatos y ordena por nombre e ID. Nombre, teléfono, email y notas se normalizan antes de persistir; el duplicado de teléfono dentro del mismo negocio devuelve 409 saneado y entre negocios está permitido.

La UI `/app/clientes` usa el cliente API central, TanStack Query, React Hook Form, Zod y componentes shadcn existentes. Incluye listado responsive, búsqueda, paginación, create/edit/active y estados de error saneados. Los e2e cubren auth, permisos actuales, aislamiento A/B, cross-tenant 404, validación, normalización y duplicados.

Limitaciones: no DELETE, historial comercial, etiquetas, importación, merge de duplicados ni otras funciones CRM.
