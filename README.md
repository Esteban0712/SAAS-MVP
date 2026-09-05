# Deenova MVP

SaaS modular multi-tenant para negocios de servicios. Incluye autenticación real, autorización por permisos, aislamiento tenant y gestión de usuarios, roles y clientes.

## Stack

- Frontend: React, TypeScript, Vite, React Router y TanStack Query.
- Backend: NestJS, TypeScript y API REST en monolito modular.
- Persistencia: PostgreSQL 16 y Prisma.
- Seguridad: contraseñas Argon2id y JWT transportado exclusivamente mediante cookie HttpOnly.

## Desarrollo local

1. Copia `backend/.env.example` a `backend/.env` y completa valores locales no reutilizados fuera de desarrollo.
2. Levanta PostgreSQL:

```bash
cd infrastructure
docker compose up -d postgres
```

3. Prepara y arranca el backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

4. Configura `frontend/.env` desde su ejemplo y arranca el frontend:

```bash
cd frontend
npm install
npm run dev
```

El frontend usa normalmente `http://localhost:5173` y el backend `http://localhost:3000/api`.

## Seguridad y tenancy

- USER tenant y PLATFORM son identidades independientes.
- El JWT nunca se entrega a código frontend ni se guarda en web storage.
- La cookie de sesión es `HttpOnly`, `SameSite=Lax`, limitada a `/api` y `Secure` en producción.
- El JWT expira según `JWT_EXPIRES_IN` (`8h` por defecto); la cookie local tiene una duración máxima de 8 horas.
- CORS permite credenciales únicamente desde `FRONTEND_URL`.
- Toda mutación exige que el header `Origin` coincida exactamente con `FRONTEND_URL`, como defensa CSRF adicional.
- El principal se reconstruye desde la base de datos en cada request. Estado, negocio, rol y permisos actuales se vuelven a comprobar.
- `businessId` siempre deriva del principal autenticado. Body, query o headers no pueden cambiar el tenant efectivo.
- Los services filtran explícitamente por `businessId`; IDs de otro tenant responden 404.
- La autorización usa códigos de permisos, nunca nombres de rol.

## Funcionalidad de Fase 6

- Login tenant y plataforma, `/me`, refresh mediante cookie y logout.
- Guards reutilizables para autenticación, tenant, plataforma y permisos.
- API tenant de Users y Roles, sin DELETE destructivo.
- Catálogo global Permission de solo lectura para tenants.
- Frontend con rutas protegidas, identidad real y navegación filtrada por permisos como UX.
- `/app/usuarios` permite listar, crear y editar usuarios, estados, roles y asignaciones de permisos.

## Clientes — Fase 7

- API REST tenant-scoped para listar, consultar, crear y actualizar Customers, sin DELETE.
- Acceso de lectura mediante `customers.view` y escritura mediante `customers.manage`.
- Búsqueda por nombre, teléfono o email y paginación con metadatos.
- Normalización consistente de nombre, teléfono, email y notas.
- El teléfono es único dentro de cada negocio; puede repetirse entre tenants distintos.
- `/app/clientes` ofrece listado responsive, búsqueda, paginación, creación, edición y cambio de estado.

## Empleados y servicios — Fase 8

- CRUD sin DELETE de Employees y Services, siempre aislado por negocio.
- Asignación completa e idempotente de Services a cada Employee.
- Horario semanal con varios bloques por día, validación de solapamientos y reemplazo atómico.
- Price se conserva como decimal exacto en string y duration se expresa en minutos enteros.
- `/app/empleados` y `/app/servicios` ofrecen gestión responsive con permisos y datos reales.

## Agenda y citas — Fase 9

- API tenant-scoped para disponibilidad y gestión de Appointments, protegida por `appointments.view/manage`.
- Availability combina `EmployeeSchedule` local, servicios asignados y duración completa con granularidad de 15 minutos.
- Los horarios semanales se interpretan en `Business.timezone`; las citas se persisten como instantes UTC y la API contempla transiciones DST ambiguas o inexistentes.
- `AppointmentService` conserva snapshots inmutables de nombre, duración y precio decimal del servicio.
- PostgreSQL impide reservas bloqueantes solapadas mediante una exclusion constraint sobre `[startAt,endAt)`; los conflictos concurrentes responden 409.
- `/app/agenda` ofrece agenda diaria responsive, detalle, creación, edición, reprogramación, estados y selección de availability real.
- Limitación actual: no existen holidays, time-off complejo ni excepciones de jornada por fecha.

Consulta [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md) y [docs/README.md](docs/README.md) para contratos, pruebas y limitaciones.

## Estado

Fase actual: **Fase 12 — administración Platform de negocios**. Billing y planes quedan diferidos; F11/WhatsApp permanece aplazada.

Nunca deben guardarse secretos, tokens, contraseñas reales ni archivos `.env` en Git.
