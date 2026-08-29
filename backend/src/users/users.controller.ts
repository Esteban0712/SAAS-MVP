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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.view')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return principal.actorType === 'USER'
      ? this.users.list(principal.businessId)
      : [];
  }

  @Post()
  @Permissions('users.manage')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateUserDto,
  ) {
    return principal.actorType === 'USER'
      ? this.users.create(principal.businessId, input)
      : undefined;
  }

  @Get(':id')
  @Permissions('users.view')
  findOne(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return principal.actorType === 'USER'
      ? this.users.findOne(principal.businessId, id)
      : undefined;
  }

  @Patch(':id')
  @Permissions('users.manage')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.users.update(principal, id, input);
  }
}
