# Backend de Deenova MVP

API REST construida con NestJS 11 y TypeScript como monolito modular. Utiliza PostgreSQL 16 y Prisma 7.10.0 mediante `@prisma/adapter-pg`.

## Configuración local

Requiere Node.js 22.14.0, npm y PostgreSQL local. Copia `.env.example` como `.env` y define `DATABASE_URL`. El archivo `.env` es local, está ignorado por Git y nunca debe contener credenciales que se versionen.

La API usa el prefijo global `/api`. El endpoint `GET /api/health` consulta PostgreSQL: responde HTTP 200 con la base disponible y HTTP 503 con una respuesta saneada cuando no está disponible.

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

## Verificación

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```
