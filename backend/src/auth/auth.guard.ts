import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import type { AuthenticatedPrincipal, AuthTokenPayload } from './auth.types';

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.cookies.name] as string | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwt.verifyAsync<AuthTokenPayload>(token);
      request.principal = await this.auth.resolvePrincipal(payload);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
