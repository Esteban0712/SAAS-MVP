import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { ReplaceEmployeeSchedulesDto } from './dto/replace-employee-schedules.dto';
import { ReplaceEmployeeServicesDto } from './dto/replace-employee-services.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
@Controller('employees')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}
  private businessId(p: AuthenticatedPrincipal) {
    return p.actorType === 'USER' ? p.businessId : '';
  }
  @Get() @Permissions('employees.view') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListEmployeesQueryDto,
  ) {
    return this.employees.list(this.businessId(p), q);
  }
  @Get('branches') @Permissions('employees.view') branches(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
  ) {
    return this.employees.listBranches(this.businessId(p));
  }
  @Post() @Permissions('employees.manage') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() body: CreateEmployeeDto,
  ) {
    return this.employees.create(this.businessId(p), body);
  }
  @Get(':id') @Permissions('employees.view') findOne(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.employees.findOne(this.businessId(p), id);
  }
  @Patch(':id') @Permissions('employees.manage') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateEmployeeDto,
  ) {
    return this.employees.update(this.businessId(p), id, body);
  }
  @Get(':id/services') @Permissions('employees.view') services(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.employees.getServices(this.businessId(p), id);
  }
  @Put(':id/services') @Permissions('employees.manage') replaceServices(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReplaceEmployeeServicesDto,
  ) {
    return this.employees.replaceServices(
      this.businessId(p),
      id,
      body.serviceIds,
    );
  }
  @Get(':id/schedules') @Permissions('employees.view') schedules(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.employees.getSchedules(this.businessId(p), id);
  }
  @Put(':id/schedules') @Permissions('employees.manage') replaceSchedules(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReplaceEmployeeSchedulesDto,
  ) {
    return this.employees.replaceSchedules(
      this.businessId(p),
      id,
      body.schedules,
    );
  }
}
