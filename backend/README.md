# Backend de Deenova MVP

Backend REST de Deenova MVP, desarrollado con NestJS y TypeScript siguiendo una arquitectura de monolito modular.

## Requisitos

- Node.js 22.14.0.
- npm.

## Instalación y configuración

```bash
npm install
```

Copia `.env.example` como `.env` antes de iniciar la aplicación. En PowerShell:

```powershell
Copy-Item .env.example .env
```

Variables disponibles:

- `NODE_ENV`: entorno de ejecución.
- `PORT`: puerto HTTP; por defecto `3000`.
- `API_PREFIX`: prefijo global de la API; por defecto `api`.
- `FRONTEND_URL`: origen permitido por CORS.

No guardes secretos, tokens, contraseñas ni credenciales reales en Git.

## Ejecución

```bash
npm run start:dev
```

## Verificación

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## Health check

```text
GET /api/health
```

Prisma y PostgreSQL todavía no forman parte de esta fase.
