import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().principal;
    if (
      !principal ||
      principal.actorType !== 'USER' ||
      !required.every((permission) =>
        principal.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException();
    }

    return true;
  }
}
