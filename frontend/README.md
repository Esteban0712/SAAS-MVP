# Deenova MVP — Frontend

Frontend responsive del MVP de Deenova. Incluye autenticación real por cookie, áreas protegidas USER/PLATFORM y gestión tenant de usuarios, roles, permisos y clientes.

Fase 12 añade `/platform/businesses`, `/platform/businesses/new` y `/platform/businesses/:id`: listado, filtros, paginación, alta completa, detalle, edición administrativa, counts, branches, timestamps y suspend/reactivate con confirmación. Usa el shell PLATFORM, TanStack Query, React Hook Form, Zod, shadcn y el cliente API existente; slug/status/settings respetan sus restricciones de solo creación, acción dedicada y solo lectura.

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

## Clientes

`/app/clientes` consume la API real mediante TanStack Query. Presenta un listado responsive en tarjetas con búsqueda por submit, paginación y total; permite crear, editar y cambiar el estado activo con React Hook Form y Zod. Tras una mutación invalida únicamente los listados de Customers.

La página no consulta Customers sin `customers.view` y oculta las acciones de escritura sin `customers.manage`; esta ocultación es solo UX y el backend sigue autorizando cada llamada. Los formularios nunca incluyen `businessId` ni `branchId`, no usan mocks y muestran estados de carga, vacío, error, guardado, validación, duplicado 409 y forbidden 403.

## Empleados y servicios

`/app/empleados` incluye listado, búsqueda, paginación, formulario con Branch tenant-scoped, estado, teléfono y notas. La edición separa Datos, Servicios y Horario: el catálogo de Services se carga bajo demanda, el PUT conserva la selección completa y el editor semanal permite varios bloques por día, active y validación previa de formato, orden y solapamientos.

`/app/servicios` gestiona nombre, categoría, descripción, duración, price y active. Price permanece como string en formularios y requests; solo se presenta con símbolo monetario. Ambas páginas usan cards responsive, TanStack Query, React Hook Form y Zod, deshabilitan queries sin permiso view y ocultan mutaciones sin manage. No hay mocks, FullCalendar ni campos `businessId`/`userId` editables.

## Limitaciones actuales

- No hay recuperación o reset de contraseña.
- No hay DELETE de Users o Roles.
- No hay DELETE de Customers ni CRM avanzado.
- No hay DELETE de Employees o Services, vínculo editable Employee–User, excepciones horarias ni time-off.
- No existe aún UI funcional para agenda, citas o ventas.
- Los indicadores del dashboard son datos DEMO locales y ficticios.
