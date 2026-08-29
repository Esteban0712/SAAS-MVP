import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginValidationMiddleware implements NestMiddleware {
  private readonly frontendUrl: string;

  constructor(configService: ConfigService) {
    this.frontendUrl = configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.get('origin');
      if (origin !== this.frontendUrl) {
        throw new ForbiddenException('Origin not allowed');
      }
    }

    next();
  }
}
