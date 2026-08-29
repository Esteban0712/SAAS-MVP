import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().principal;

    if (!principal || principal.actorType !== 'PLATFORM') {
      throw new ForbiddenException();
    }

    return true;
  }
}
