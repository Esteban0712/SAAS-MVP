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

Los códigos utilizados son `users.view`, `users.manage`, `roles.view` y `roles.manage`. Permission es un catálogo global de solo lectura; cada Role pertenece a un Business.

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

Los e2e requieren PostgreSQL, `JWT_SECRET` y `DEV_SEED_PASSWORD` locales. Los fixtures restauran los hashes y datos temporales que modifican.
