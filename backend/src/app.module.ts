import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { OriginValidationMiddleware } from './common/middleware/origin-validation.middleware';
import { CustomersModule } from './customers/customers.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { ServicesModule } from './services/services.module';
import { SalesModule } from './sales/sales.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CustomersModule,
    EmployeesModule,
    ServicesModule,
    AppointmentsModule,
    SalesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginValidationMiddleware).forRoutes('*');
  }
}
