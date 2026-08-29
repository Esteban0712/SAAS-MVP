# Deenova MVP — Frontend

Frontend responsive del MVP de Deenova. Incluye autenticación real por cookie, áreas protegidas USER/PLATFORM y gestión tenant de usuarios, roles y permisos.

## Stack

- React 19.2.8 y React DOM 19.2.8.
- TypeScript 5.9.3.
- Vite 8.2.2.
- React Router 7.18.3.
- TanStack Query 5.102.8.
- Tailwind CSS 4.3.3.
- shadcn 4.19.0 con componentes `radix-nova` y Lucide React.

## Instalación y configuración

Requiere Node.js 22 y npm. Desde `frontend/`:

```bash
npm install
```

Copia `.env.example` a `.env` y configura la URL pública de la API:

```env
VITE_API_URL=http://localhost:3000/api
```

No guardes secretos en variables `VITE_*`: Vite las expone al navegador. El archivo `.env` es local y está ignorado por Git; `.env.example` sí debe versionarse.

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm audit
```

El servidor de desarrollo usa normalmente `http://localhost:5173`.

## Estructura principal

```text
src/
├── api/                 # Cliente fetch y configuración de Query
├── app/                 # Providers y router
├── components/          # Layouts, componentes compartidos y UI
├── features/            # Funcionalidad organizada por dominio
├── hooks/               # Hooks compartidos
├── lib/                 # Utilidades
├── pages/               # Páginas y placeholders de rutas
└── types/               # Tipos compartidos
```

## Rutas

- Públicas: `/login` y redirección de `/` a `/app/dashboard`.
- Admin: `/app/dashboard`, `/app/agenda`, `/app/clientes`, `/app/empleados`, `/app/servicios`, `/app/ventas`, `/app/usuarios` y `/app/configuracion`.
- Employee: `/employee/today` y `/employee/appointments/:id`.
- Platform: `/platform/businesses`, `/platform/businesses/new` y `/platform/businesses/:id`.
- Cualquier ruta no reconocida muestra la página 404.

## UI y estilos

Tailwind CSS proporciona los estilos y responsive. La base visual utiliza componentes shadcn con estilo `radix-nova`; el sidebar, sheet, cards y demás primitivas viven en `src/components/ui/`. shadcn/ui procede de [shadcn-ui/ui](https://github.com/shadcn-ui/ui) y se distribuye bajo licencia MIT.

## API y health

`src/api/client.ts` centraliza las solicitudes con `fetch`, usa `credentials: include`, toma la base URL de `VITE_API_URL` y transforma fallos HTTP o de red en errores públicos sanitizados.

El módulo `src/features/health/` consulta `GET /health` mediante TanStack Query. El dashboard muestra los estados de carga, servicio disponible y backend no disponible. Cuando existe un error, la consulta reintenta periódicamente para recuperarse sin reiniciar el frontend.

## Auth y gestión de acceso

- `/login` permite seleccionar acceso tenant o plataforma mediante React Hook Form y Zod.
- `GET /auth/me` es la fuente de sesión de TanStack Query y recupera la sesión tras refresh.
- `/app/*` y `/employee/*` requieren USER; `/platform/*` requiere PLATFORM.
- Logout invalida y limpia la caché antes de volver a `/login`.
- No se almacena JWT en web storage: el navegador solo administra la cookie HttpOnly.
- La navegación se oculta según permisos únicamente como UX; el backend autoriza cada request.
- `/app/usuarios` lista, crea y edita Users, estados y roles; también gestiona Roles y sus Permissions. Password solo se solicita al crear un User.

## Limitaciones actuales

- No hay recuperación o reset de contraseña.
- No hay DELETE de Users o Roles.
- No existe aún UI funcional para clientes, agenda, empleados, servicios o ventas.
- Los indicadores del dashboard son datos DEMO locales y ficticios.
