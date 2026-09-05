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

## Fase 8 — Workforce y catálogo

Employees, Services, EmployeeService y EmployeeSchedule utilizan el schema original, sin migraciones. `businessId` siempre procede del principal; Branch, Employee y Service relacionados se verifican dentro del mismo tenant y los IDs cross-tenant responden 404. Los permisos son `employees.view/manage` y `services.view/manage`.

Las asignaciones EmployeeService y los horarios se reemplazan completamente con PUT y una única transacción. Los schedules permiten varios bloques por día, usan intervalos `[start,end)`, admiten adyacencia y se ordenan MONDAY–SUNDAY, startTime y endTime. PostgreSQL `TIME(0)` representa hora de pared local del negocio: el API usa `HH:mm:ss`, no UTC instant ni fecha. Price viaja como string decimal exacto y duration como minutos enteros.

El frontend proporciona `/app/empleados` y `/app/servicios`, formularios responsive, selector read-only de Branch, asignación de catálogo y editor semanal sin FullCalendar. Las suites unit/E2E cubren CRUD, permisos, tenancy, relaciones, Decimal, TIME, validaciones y atomicidad.

## Base de workforce utilizada por Fase 9

- Employee utilizable: `Employee.active === true`; además debe pertenecer al tenant y a la Branch requerida.
- Service utilizable: `Service.active === true` y pertenece al tenant.
- Duración efectiva: `Service.durationMinutes`; EmployeeService no contiene override.
- Precio efectivo: `Service.price` como `DECIMAL(12,2)`/string fijo; EmployeeService no contiene override.
- Servicios del Employee: filas `EmployeeService` cuyo `employeeId` y Service resuelven dentro del mismo tenant.
- Horario base: filas `EmployeeSchedule { dayOfWeek, startTime, endTime, active }` del Employee.
- Solo schedules con `active === true` participan en un cálculo futuro.
- `TIME(0)` es hora local de pared en `Business.timezone`; no es un instante UTC y se combina con la fecha local al calcular availability.
- Cada bloque tiene semántica `[start,end)`: el inicio incluye y el final excluye; bloques adyacentes no se solapan.
- Orden canónico: MONDAY a SUNDAY, luego `startTime ASC`, `endTime ASC`.
- Aún faltan excepciones por fecha, holidays, time-off y overrides de jornada. No se infieren de EmployeeSchedule.

## Fase 9 — Appointments y Agenda

Availability usa la estructura anterior para generar candidatos cada 15 minutos. La duración efectiva es la suma completa de los Services seleccionados y debe caber dentro de un único bloque. Los intervalos son `[start,end)`, por lo que citas y bloques adyacentes están permitidos. PENDING, CONFIRMED e IN_PROGRESS bloquean; los estados terminales y RESCHEDULED liberan el intervalo.

Las horas semanales se interpretan en la zona IANA del Business y se convierten a UTC mediante Luxon. Una hora local inexistente por DST no produce slot; una hora ambigua puede representar sus instantes UTC válidos. El frontend nunca calcula disponibilidad: usa el UTC devuelto por el backend y presenta las horas con el timezone recibido en el listado.

Create, edit y reschedule son atómicos. AppointmentService captura snapshots de nombre, duración y precio decimal. Una exclusion constraint PostgreSQL es la garantía final frente a doble reserva, con 409 saneado; RESCHEDULE bloquea además la cita original para impedir sucesoras concurrentes. Todas las relaciones se validan dentro del tenant y `businessId` procede exclusivamente del principal.

La Agenda diaria incluye navegación por fecha, filtro de Employee, cards responsive, detalle, create/edit/reschedule/status/cancel y refresco de listado/availability ante mutaciones o conflictos. Limitaciones conocidas: sin holidays, time-off complejo, recurrencia, drag/drop, FullCalendar ni disponibilidad basada en excepciones por fecha.

## Fase 12 — Administración Platform de negocios

`PlatformUser` es una identidad global independiente de `User`: no contiene `businessId`, inicia sesión en `/api/platform/auth/login` y accede a `/api/platform/*` mediante `AuthGuard` y `PlatformGuard`. Un User tenant recibe 403 en esa superficie. Solo un PlatformUser `ACTIVE` puede autenticarse y conservar sesión; `PlatformUserStatus` también contiene `SUSPENDED` y `DISABLED`.

Business conserva nombre, slug único, status, timezone, moneda, máximo de usuarios, datos administrativos, `settingsJson` y timestamps. `BusinessStatus` es `TRIAL | ACTIVE | PAYMENT_PENDING | SUSPENDED | CANCELLED`. Branch pertenece al Business; el alta crea una Branch principal activa porque las operaciones tenant dependen de sucursal.

Create es una transacción Prisma única: Business `ACTIVE`, Branch principal, Role `ADMIN` system-default con el catálogo actual de Permission, User owner tenant y AuditLog. La contraseña inicial cumple requisitos fuertes, solo se persiste como hash Argon2id y el User queda con `mustChangePassword=true`; no existe contraseña default. El cliente nunca envía `businessId`.

El slug se normaliza a minúsculas ASCII con guiones y queda inmutable. Timezone se valida como IANA mediante Luxon. Update admite nombre, timezone, moneda, máximo de usuarios, logo, identificación fiscal, dirección y teléfono; `settingsJson` es read-only. Status cambia solo mediante suspend/reactivate.

Suspend exige `ACTIVE` y cambia a `SUSPENDED`; reactivate exige `SUSPENDED` y vuelve a `ACTIVE`. No se borra ni desactiva información relacionada. Como Auth reconstruye el principal desde PostgreSQL en cada request, una sesión tenant existente recibe 401 al suspender y recupera acceso al reactivar. Orígenes inválidos responden 409.

Create, update, suspend y reactivate escriben AuditLog dentro de su transacción, con PlatformUser actor, Business, acción y snapshots. El detalle devuelve Branches y counts de branches, users, customers, employees, services, appointments y sales; el listado no calcula counts por fila.

API: `GET/POST /api/platform/businesses`, `GET/PATCH /api/platform/businesses/:id`, `POST /api/platform/businesses/:id/suspend` y `POST /api/platform/businesses/:id/reactivate`. El listado admite search, status, page y pageSize. Los errores se sanean como 400/401/403/404/409 sin detalles Prisma.

El frontend implementa `/platform/businesses`, `/platform/businesses/new` y `/platform/businesses/:id` con shell PLATFORM, TanStack Query, React Hook Form, Zod y shadcn. Incluye listado, filtros, paginación, create, detail/update, confirmación de transiciones, counts, branches, timestamps, settings read-only, estados loading/empty/error/success y layout responsive.

Las pruebas cubren separación Platform/Tenant, atomicidad, slug/timezone, admin/Role/Permission, AuditLog, counts y suspensión/reactivación con sesión existente. Limitaciones: sin invitación/reset de contraseña, UI de historial AuditLog ni restauración a un estado distinto de ACTIVE. Billing, planes y subscriptions quedan diferidos. F11/WhatsApp permanece aplazada e intacta.
