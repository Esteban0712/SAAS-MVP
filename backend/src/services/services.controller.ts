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
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}
  private businessId(principal: AuthenticatedPrincipal) {
    return principal.actorType === 'USER' ? principal.businessId : '';
  }
  @Get() @Permissions('services.view') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListServicesQueryDto,
  ) {
    return this.services.list(this.businessId(p), q);
  }
  @Post() @Permissions('services.manage') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() input: CreateServiceDto,
  ) {
    return this.services.create(this.businessId(p), input);
  }
  @Get(':id') @Permissions('services.view') findOne(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.services.findOne(this.businessId(p), id);
  }
  @Patch(':id') @Permissions('services.manage') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateServiceDto,
  ) {
    return this.services.update(this.businessId(p), id, input);
  }
}
