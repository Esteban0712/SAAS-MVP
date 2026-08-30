/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const row = {
    id: 's1',
    businessId: 'b1',
    name: 'Hair Cut',
    durationMinutes: 30,
    price: new Prisma.Decimal('25'),
    active: true,
    description: null,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    service: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new ServicesService(prisma as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());

  it('scopes search/pagination and serializes Decimal', async () => {
    prisma.$transaction.mockResolvedValue([[row], 3]);
    const result = await service.list('b1', {
      search: 'hair',
      page: 2,
      pageSize: 1,
    });
    expect(prisma.service.findMany.mock.calls[0][0]).toMatchObject({
      where: { businessId: 'b1' },
      skip: 1,
      take: 1,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(result.items[0].price).toBe('25.00');
    expect(result.totalPages).toBe(3);
  });

  it('normalizes fields and persists Prisma Decimal', async () => {
    prisma.service.create.mockResolvedValue(row);
    await service.create('b1', {
      name: ' Hair   Cut ',
      durationMinutes: 30,
      price: '25.00',
      description: ' ',
      category: ' Hair ',
    });
    const data = prisma.service.create.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data).toMatchObject({
      businessId: 'b1',
      name: 'Hair Cut',
      description: null,
      category: 'Hair',
    });
    expect((data.price as Prisma.Decimal).toFixed(2)).toBe('25.00');
  });

  it('rejects empty patch and cross-tenant detail', async () => {
    await expect(service.update('b1', 's1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(service.findOne('b1', 's2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
