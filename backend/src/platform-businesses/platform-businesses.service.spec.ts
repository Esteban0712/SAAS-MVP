import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlatformBusinessesService } from './platform-businesses.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('PlatformBusinessesService', () => {
  const passwordHash = 'argon-hash';
  const passwords = { hash: jest.fn().mockResolvedValue(passwordHash) };

  function setup(options?: {
    permissions?: Array<{ id: string }>;
    error?: Error;
  }) {
    const tx = {
      business: {
        create: jest.fn().mockResolvedValue({ id: 'business-id' }),
      },
      branch: { create: jest.fn().mockResolvedValue({}) },
      role: { create: jest.fn().mockResolvedValue({ id: 'role-id' }) },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue(options?.permissions ?? [{ id: 'permission-id' }]),
      },
      rolePermission: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const detail = {
      id: 'business-id',
      branches: [],
      _count: { branches: 1, users: 1 },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        options?.error
          ? Promise.reject(options.error)
          : Promise.resolve(callback(tx)),
      ),
      business: { findUnique: jest.fn().mockResolvedValue(detail) },
    };
    const service = new PlatformBusinessesService(
      prisma as never,
      passwords as never,
    );
    return { service, prisma, tx };
  }

  const input = {
    name: '  Acme   Ltd  ',
    slug: '  Ácme  Central ',
    timezone: 'Europe/Malta',
    currency: 'eur',
    maxUsers: 10,
    branch: { name: ' Main ' },
    admin: {
      username: ' admin ',
      password: 'Strong-password1!',
      email: 'ADMIN@EXAMPLE.TEST',
    },
  };

  it('atomically creates the business graph and audit without exposing a password', async () => {
    const { service, prisma, tx } = setup();
    const result = await service.create('platform-id', input);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'acme-central',
          status: 'ACTIVE',
          currency: 'EUR',
        }),
      }),
    );
    expect(tx.branch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isMain: true, active: true }),
      }),
    );
    expect(tx.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'ADMIN', isSystemDefault: true }),
      }),
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash,
          mustChangePassword: true,
          isOwner: true,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformUserId: 'platform-id',
          action: 'BUSINESS_CREATED',
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(input.admin.password);
  });

  it('rejects an invalid timezone before opening a transaction', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create('platform-id', { ...input, timezone: 'GMT+2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('maps a unique constraint failure to a sanitized slug conflict', async () => {
    const { service } = setup({
      error: Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
        meta: { target: ['slug'] },
      }),
    });
    await expect(service.create('platform-id', input)).rejects.toEqual(
      new ConflictException('Business slug already exists'),
    );
  });

  it('rolls back creation when the permission catalog is empty', async () => {
    const { service, tx } = setup({ permissions: [] });
    await expect(service.create('platform-id', input)).rejects.toThrow(
      'Permission catalog is empty',
    );
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
