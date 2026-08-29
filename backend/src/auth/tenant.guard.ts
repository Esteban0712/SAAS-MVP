import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().principal;

    if (!principal || principal.actorType !== 'USER') {
      throw new ForbiddenException();
    }

    return true;
  }
}
