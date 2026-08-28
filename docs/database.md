# Base de datos de Deenova MVP

La capa de datos utiliza PostgreSQL 16 y Prisma 7.10.0. El schema inicial contiene 19 modelos y 11 enums, definidos por la migración `init_mvp_schema`.

## Criterios del modelo

- Arquitectura multi-tenant con `businessId` directo en las entidades que requieren aislamiento por negocio.
- `AuditLog.businessId` es nullable para permitir auditoría de acciones de plataforma sin negocio asociado.
- Identificadores principales y foráneos en UUID.
- Importes monetarios con `Decimal(12,2)`.
- Timestamps con `DateTime`, tratados como UTC por la aplicación.
- Horarios de `EmployeeSchedule` almacenados como PostgreSQL `TIME`.
- `SaleItem.quantity` es un entero.
- Se conservan snapshots históricos en `AppointmentService`, `SaleItem` y `Receipt.dataJson` para evitar que cambios posteriores alteren documentos o transacciones previas.

Las acciones referenciales siguen una política conservadora: las entidades históricas y de negocio usan principalmente `Restrict` o `SetNull`. `Cascade` se limita a joins seguros como `RolePermission` y `EmployeeService`.

## Migraciones

En desarrollo se crean y aplican migraciones con `prisma migrate dev`. En staging y producción se aplican migraciones existentes con `prisma migrate deploy`.

Reglas obligatorias:

- Nunca editar una migración ya aplicada en producción.
- Nunca borrar el historial de migraciones.
- Nunca ejecutar `prisma migrate reset` en producción o sobre datos valiosos.
- Nunca sustituir las migraciones por `prisma db push`.
