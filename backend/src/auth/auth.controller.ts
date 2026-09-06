import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedPrincipal } from './auth.types';
import { CurrentPrincipal } from './current-principal.decorator';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginRateLimitGuard)
  async login(
    @Body() input: TenantLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedPrincipal> {
    const result = await this.auth.loginTenant(input);
    this.cookies.set(response, result.token);
    return result.principal;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): AuthenticatedPrincipal {
    return principal;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    this.cookies.clear(response);
  }
}
