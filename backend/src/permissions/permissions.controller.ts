import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @Permissions('roles.view')
  list() {
    return this.permissions.list();
  }
}
