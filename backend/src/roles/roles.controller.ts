import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('roles.view')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return principal.actorType === 'USER'
      ? this.roles.list(principal.businessId)
      : [];
  }

  @Post()
  @Permissions('roles.manage')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateRoleDto,
  ) {
    return principal.actorType === 'USER'
      ? this.roles.create(principal.businessId, input)
      : undefined;
  }

  @Get(':id')
  @Permissions('roles.view')
  findOne(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return principal.actorType === 'USER'
      ? this.roles.findOne(principal.businessId, id)
      : undefined;
  }

  @Patch(':id')
  @Permissions('roles.manage')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateRoleDto,
  ) {
    return this.roles.update(principal, id, input);
  }
}
