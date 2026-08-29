import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthService', () => {
  const tenantUser = {
    id: 'user-a',
    businessId: 'business-a',
    roleId: 'role-a',
    username: 'admin',
    displayName: 'Admin A',
    passwordHash: 'argon2-hash',
    status: 'ACTIVE',
    business: { status: 'ACTIVE' },
    role: {
      active: true,
      permissions: [{ permission: { code: 'dashboard.view' } }],
    },
  };
  const platformUser = {
    id: 'platform-user',
    username: 'platform_admin',
    passwordHash: 'argon2-hash',
    status: 'ACTIVE',
  };
  const prisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    platformUser: { findUnique: jest.fn() },
  };
  const passwords = { verify: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
  const config = { get: jest.fn().mockReturnValue('8h') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    passwords as unknown as PasswordService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs in an active tenant user and signs a tenant-scoped token', async () => {
    prisma.user.findFirst.mockResolvedValue(tenantUser);
    passwords.verify.mockResolvedValue(true);

    const result = await service.loginTenant({
      businessSlug: 'demo-business-a',
      username: 'admin',
      password: 'development-password',
    });

    expect(result.principal).toEqual({
      actorType: 'USER',
      userId: 'user-a',
      businessId: 'business-a',
      roleId: 'role-a',
      username: 'admin',
      displayName: 'Admin A',
      permissions: ['dashboard.view'],
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'user-a', actorType: 'USER', businessId: 'business-a' },
      { expiresIn: '8h' },
    );
  });

  it('rejects incorrect credentials without exposing the reason', async () => {
    prisma.user.findFirst.mockResolvedValue(tenantUser);
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.loginTenant({
        businessSlug: 'demo-business-a',
        username: 'admin',
        password: 'incorrect',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it.each([
    ['inactive user', { status: 'SUSPENDED' }, {}],
    ['inactive business', {}, { status: 'SUSPENDED' }],
  ])('rejects an %s', async (_label, userChange, businessChange) => {
    prisma.user.findFirst.mockResolvedValue({
      ...tenantUser,
      ...userChange,
      business: { ...tenantUser.business, ...businessChange },
    });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.loginTenant({
        businessSlug: 'demo-business-a',
        username: 'admin',
        password: 'development-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in an active platform user without a businessId claim', async () => {
    prisma.platformUser.findUnique.mockResolvedValue(platformUser);
    passwords.verify.mockResolvedValue(true);

    const result = await service.loginPlatform({
      username: 'platform_admin',
      password: 'development-password',
    });

    expect(result.principal).toEqual({
      actorType: 'PLATFORM',
      platformUserId: 'platform-user',
      username: 'platform_admin',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'platform-user', actorType: 'PLATFORM' },
      { expiresIn: '8h' },
    );
  });

  it('rejects an inactive platform user', async () => {
    prisma.platformUser.findUnique.mockResolvedValue({
      ...platformUser,
      status: 'DISABLED',
    });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.loginPlatform({
        username: 'platform_admin',
        password: 'development-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['inactive user', { status: 'SUSPENDED' }, {}],
    ['inactive business', {}, { status: 'SUSPENDED' }],
  ])(
    'rejects an existing JWT for an %s',
    async (_label, userChange, businessChange) => {
      prisma.user.findUnique.mockResolvedValue({
        ...tenantUser,
        ...userChange,
        business: { ...tenantUser.business, ...businessChange },
      });

      await expect(
        service.resolvePrincipal({
          sub: 'user-a',
          actorType: 'USER',
          businessId: 'business-a',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});
