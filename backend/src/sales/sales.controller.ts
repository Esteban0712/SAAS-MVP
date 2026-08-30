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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  private user(principal: AuthenticatedPrincipal) {
    if (principal.actorType !== 'USER')
      throw new Error('TenantGuard invariant');
    return principal;
  }
  @Get() @Permissions('sales.view') list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query() q: ListSalesQueryDto,
  ) {
    return this.sales.list(this.user(p).businessId, q);
  }
  @Post() @Permissions('sales.manage') create(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Body() dto: CreateSaleDto,
  ) {
    const u = this.user(p);
    return this.sales.create(u.businessId, u.userId, dto);
  }
  @Get(':id') @Permissions('sales.view') detail(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sales.findOne(this.user(p).businessId, id);
  }
  @Patch(':id') @Permissions('sales.manage') update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.sales.update(this.user(p).businessId, id, dto);
  }
  @Get(':id/payments') @Permissions('sales.view') payments(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sales.payments(this.user(p).businessId, id);
  }
  @Post(':id/payments') @Permissions('sales.manage') addPayment(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    const u = this.user(p);
    return this.sales.addPayment(u.businessId, u.userId, id, dto);
  }
  @Get(':id/receipt') @Permissions('sales.view') receipt(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sales.receipt(this.user(p).businessId, id);
  }
  @Post(':id/receipt') @Permissions('sales.manage') generateReceipt(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sales.generateReceipt(this.user(p).businessId, id);
  }
}
