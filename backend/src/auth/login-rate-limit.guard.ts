import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoginRateLimitService } from './login-rate-limit.service';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: LoginRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const retryAfter = this.limiter.consume(
      `${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${request.path}`,
    );

    if (retryAfter !== null) {
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        'Too many login attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
