# AGENTS.md

## Reglas de trabajo para Codex / IA

Este repositorio corresponde al proyecto **Deenova MVP**.

### Stack fijo

* Frontend: React + TypeScript + Vite.
* Backend: NestJS + TypeScript.
* Base de datos: PostgreSQL.
* ORM: Prisma.
* Arquitectura backend: monolito modular.
* API: REST.
* El sistema debe ser multi-tenant.

### Reglas obligatorias

* No cambiar el stack sin autorización.
* No añadir dependencias sin explicar y justificar su necesidad.
* No introducir secretos, tokens, contraseñas ni credenciales reales.
* No tocar configuración de producción salvo instrucción explícita.
* No modificar migraciones ya aplicadas.
* No mezclar varios módulos o tareas grandes en un mismo cambio.
* Mantener los controllers delgados.
* Colocar la lógica de negocio en services.
* Usar Prisma para la persistencia de datos.
* Aplicar validación obligatoria en el backend.
* Ejecutar lint, tests y build cuando existan y sean relevantes.
* Explicar al finalizar qué archivos se crearon o modificaron.
* Trabajar mediante tareas pequeñas y verificables.
* No crear funcionalidades fuera del alcance solicitado.
* No adelantar fases del proyecto sin autorización.

### Estado actual

Fase actual: **Fase 2 — Repositorio y estructura inicial**.

Durante esta fase no se debe crear todavía:

* Frontend React real.
* Backend NestJS real.
* Prisma.
* schema.prisma.
* Base de datos definitiva.
* Docker Compose funcional del producto.
* Endpoints.
* Autenticación.
* Módulos de negocio.
