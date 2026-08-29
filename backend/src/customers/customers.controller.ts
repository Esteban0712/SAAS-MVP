import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Permissions('customers.view')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListCustomersQueryDto,
  ) {
    return principal.actorType === 'USER'
      ? this.customers.list(principal.businessId, query)
      : undefined;
  }

  @Post()
  @Permissions('customers.manage')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreateCustomerDto,
  ) {
    return principal.actorType === 'USER'
      ? this.customers.create(principal.businessId, input)
      : undefined;
  }

  @Get(':id')
  @Permissions('customers.view')
  findOne(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return principal.actorType === 'USER'
      ? this.customers.findOne(principal.businessId, id)
      : undefined;
  }

  @Patch(':id')
  @Permissions('customers.manage')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateCustomerDto,
  ) {
    return principal.actorType === 'USER'
      ? this.customers.update(principal.businessId, id, input)
      : undefined;
  }
}
