import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import type { AuthenticatedPrincipal } from './auth.types';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: PlatformLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatedPrincipal> {
    const result = await this.auth.loginPlatform(input);
    this.cookies.set(response, result.token);
    return result.principal;
  }
}
