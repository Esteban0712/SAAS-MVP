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
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
@Controller('appointments')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
  ) {}
  private user(p: AuthenticatedPrincipal) {
    if (p.actorType !== 'USER') throw new Error('TenantGuard invariant');
    return p;
  }
  @Get() @Permissions('appointments.view') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointments.list(this.user(p).businessId, query);
  }
  @Get('availability') @Permissions('appointments.view') available(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availability.get(this.user(p).businessId, query);
  }
  @Post() @Permissions('appointments.manage') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() input: CreateAppointmentDto,
  ) {
    const user = this.user(p);
    return this.appointments.create(user.businessId, user.userId, input);
  }
  @Get(':id') @Permissions('appointments.view') detail(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.appointments.findOne(this.user(p).businessId, id);
  }
  @Patch(':id') @Permissions('appointments.manage') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateAppointmentDto,
  ) {
    const user = this.user(p);
    return this.appointments.update(user.businessId, user.userId, id, input);
  }
}
