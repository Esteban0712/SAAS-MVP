# Backend de Deenova MVP

API REST construida con NestJS 11 y TypeScript como monolito modular. Utiliza PostgreSQL 16 y Prisma 7.10.0 mediante `@prisma/adapter-pg`.

## Configuración local

Requiere Node.js 22.14.0, npm y PostgreSQL local. Copia `.env.example` como `.env` y define `DATABASE_URL`. El archivo `.env` es local, está ignorado por Git y nunca debe contener credenciales que se versionen.

La API usa el prefijo global `/api`. `GET /api/health` consulta PostgreSQL: responde HTTP 200 con la base disponible y HTTP 503 con una respuesta saneada cuando no está disponible.

Variables relevantes:

- `DATABASE_URL`: conexión PostgreSQL local.
- `JWT_SECRET`: secreto local de firma; nunca debe versionarse ni reutilizarse.
- `JWT_EXPIRES_IN`: expiración JWT, `8h` por defecto.
- `AUTH_COOKIE_NAME`: nombre de la cookie HttpOnly.
- `FRONTEND_URL`: único origin permitido por CORS y para mutaciones.
- `DEV_SEED_PASSWORD`: contraseña ficticia usada por el seed DEV.

## Autenticación y seguridad

Las contraseñas se almacenan con Argon2id. El JWT se firma en backend y viaja en una cookie `HttpOnly`, `SameSite=Lax`, con path `/api`, `Secure` en producción y máximo de 8 horas. No se devuelve en el cuerpo de las respuestas.

La API configura CORS con credenciales para `FRONTEND_URL`. Además, toda petición no segura (`POST`, `PATCH`, etc.) debe incluir un `Origin` idéntico a `FRONTEND_URL`; esto complementa `SameSite=Lax` como estrategia CSRF.

Cada request autenticado vuelve a consultar PostgreSQL. Usuarios, negocios o roles inactivos quedan rechazados y los permisos no se confían al contenido persistido del JWT.

## Tenancy y permisos

`businessId` deriva siempre del principal autenticado. Las entradas de cliente no pueden seleccionar el tenant y los services Prisma filtran explícitamente por `businessId`. Una búsqueda por ID fuera del tenant devuelve 404.

Los códigos utilizados incluyen `users.view`, `users.manage`, `roles.view`, `roles.manage`, `customers.view` y `customers.manage`. Permission es un catálogo global de solo lectura; cada Role pertenece a un Business.

## Endpoints de Fase 6

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/auth/login` | Login USER tenant |
| POST | `/api/platform/auth/login` | Login PLATFORM |
| GET | `/api/auth/me` | Sesión actual |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET/POST | `/api/users` | `users.view` / `users.manage` |
| GET/PATCH | `/api/users/:id` | `users.view` / `users.manage` |
| GET/POST | `/api/roles` | `roles.view` / `roles.manage` |
| GET/PATCH | `/api/roles/:id` | `roles.view` / `roles.manage` |
| GET | `/api/permissions` | `roles.view` |

## Customers — Fase 7

Customer utiliza el modelo Prisma existente: `id`, `businessId`, `branchId` nullable, `name`, `phone`, `active`, `email`, `notes`, `createdAt` y `updatedAt`. `businessId` deriva siempre del principal y `branchId` es únicamente de lectura; ninguno se acepta en los DTO de escritura.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/customers?search=&page=&pageSize=` | `customers.view` |
| POST | `/api/customers` | `customers.manage` |
| GET | `/api/customers/:id` | `customers.view` |
| PATCH | `/api/customers/:id` | `customers.manage` |

Create requiere `name` y `phone`; admite `email`, `notes` y `active`. Update admite esos mismos campos opcionales y rechaza un PATCH vacío. El nombre se recorta y colapsa espacios, el email se recorta y pasa a minúsculas, las notas vacías pasan a `null`, y el teléfono elimina espacios y `()-.` conservando solo un `+` inicial y dígitos. No se infiere país ni se fabrica E.164.

El listado usa página 1 y 20 elementos por defecto, admite hasta 100, busca por nombre/teléfono/email y devuelve `items`, `page`, `pageSize`, `total` y `totalPages`. El teléfono normalizado es único por negocio: el precheck y Prisma P2002 producen un 409 saneado, mientras el mismo teléfono puede existir en tenants distintos. Detail y update filtran por `id + businessId`; un ID cross-tenant responde 404. No existe DELETE de Customers.

No existen DELETE destructivos ni endpoint de reset de contraseña en esta fase.

## Desarrollo

```bash
npm install
npm run start:dev
```

El Prisma Client se genera en `src/generated/prisma/` y no se versiona.

## Prisma y migraciones

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run db:status
```

`prisma migrate dev` se utiliza en desarrollo. En staging y producción debe utilizarse `prisma migrate deploy` para aplicar migraciones existentes.

No uses `prisma db push` como sustituto del historial de migraciones. No uses `prisma migrate reset` en producción ni en entornos con datos valiosos, y no edites migraciones que ya hayan sido aplicadas.

## Seed de desarrollo

El seed solo se ejecuta con `NODE_ENV=development` y requiere una contraseña ficticia local en `DEV_SEED_PASSWORD`:

```bash
npm run db:seed
```

Crea de forma idempotente los tenants `demo-business-a` y `demo-business-b`, el usuario `admin` en ambos y el usuario de plataforma `platform_admin`. La contraseña no está incluida en el repositorio y nunca debe reutilizarse fuera de desarrollo.

## Verificación

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm run prisma:validate
npm run prisma:generate
npm run db:status
npm audit
```

Los e2e requieren PostgreSQL, `JWT_SECRET` y `DEV_SEED_PASSWORD` locales. Los fixtures restauran los hashes y datos temporales que modifican. La suite Customers cubre CRUD sin DELETE, búsqueda, paginación, normalización, validación, duplicados, permisos, manipulación de tenant y 404 cross-tenant.
