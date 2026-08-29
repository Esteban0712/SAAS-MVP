import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal } from './auth.types';
import { PermissionsGuard } from './permissions.guard';
import { PlatformGuard } from './platform.guard';
import { TenantGuard } from './tenant.guard';

describe('Authorization guards', () => {
  const tenant: AuthenticatedPrincipal = {
    actorType: 'USER',
    userId: 'user-a',
    businessId: 'business-a',
    roleId: 'role-a',
    username: 'admin',
    displayName: 'Admin A',
    permissions: ['users.view'],
  };
  const platform: AuthenticatedPrincipal = {
    actorType: 'PLATFORM',
    platformUserId: 'platform-user',
    username: 'platform_admin',
  };

  function context(principal: AuthenticatedPrincipal): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ principal }) }),
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  }

  it('allows only tenant users through TenantGuard', () => {
    const guard = new TenantGuard();
    expect(guard.canActivate(context(tenant))).toBe(true);
    expect(() => guard.canActivate(context(platform))).toThrow(
      ForbiddenException,
    );
  });

  it('allows only platform users through PlatformGuard', () => {
    const guard = new PlatformGuard();
    expect(guard.canActivate(context(platform))).toBe(true);
    expect(() => guard.canActivate(context(tenant))).toThrow(
      ForbiddenException,
    );
  });

  it('uses current permissions from the authenticated principal', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['users.view']),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context(tenant))).toBe(true);

    reflector.getAllAndOverride.mockReturnValue(['users.manage']);
    expect(() => guard.canActivate(context(tenant))).toThrow(
      ForbiddenException,
    );
  });
});
