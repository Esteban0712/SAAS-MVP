import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { parseDurationMilliseconds } from '../config/configuration';

@Injectable()
export class AuthCookieService {
  private readonly cookieName: string;
  private readonly production: boolean;
  private readonly maxAge: number;

  constructor(configService: ConfigService) {
    this.cookieName = configService.get<string>(
      'AUTH_COOKIE_NAME',
      'deenova_session',
    );
    this.production = configService.get<string>('NODE_ENV') === 'production';
    this.maxAge = parseDurationMilliseconds(
      configService.get<string>('JWT_EXPIRES_IN', '8h'),
    );
  }

  get name(): string {
    return this.cookieName;
  }

  set(response: Response, token: string): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.production,
      sameSite: 'lax',
      path: '/api',
      maxAge: this.maxAge,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.production,
      sameSite: 'lax',
      path: '/api',
    });
  }
}
