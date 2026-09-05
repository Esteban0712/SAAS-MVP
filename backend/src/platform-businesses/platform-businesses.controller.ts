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
import { PlatformGuard } from '../auth/platform.guard';
import { CreatePlatformBusinessDto } from './dto/create-platform-business.dto';
import { ListPlatformBusinessesQueryDto } from './dto/list-platform-businesses-query.dto';
import { UpdatePlatformBusinessDto } from './dto/update-platform-business.dto';
import { PlatformBusinessesService } from './platform-businesses.service';

@Controller('platform/businesses')
@UseGuards(AuthGuard, PlatformGuard)
export class PlatformBusinessesController {
  constructor(private readonly businesses: PlatformBusinessesService) {}

  @Get()
  list(@Query() query: ListPlatformBusinessesQueryDto) {
    return this.businesses.list(query);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: CreatePlatformBusinessDto,
  ) {
    return principal.actorType === 'PLATFORM'
      ? this.businesses.create(principal.platformUserId, input)
      : undefined;
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.businesses.findOne(id);
  }

  @Patch(':id')
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdatePlatformBusinessDto,
  ) {
    return principal.actorType === 'PLATFORM'
      ? this.businesses.update(principal.platformUserId, id, input)
      : undefined;
  }

  @Post(':id/suspend')
  suspend(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return principal.actorType === 'PLATFORM'
      ? this.businesses.changeStatus(principal.platformUserId, id, 'SUSPENDED')
      : undefined;
  }

  @Post(':id/reactivate')
  reactivate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return principal.actorType === 'PLATFORM'
      ? this.businesses.changeStatus(principal.platformUserId, id, 'ACTIVE')
      : undefined;
  }
}
