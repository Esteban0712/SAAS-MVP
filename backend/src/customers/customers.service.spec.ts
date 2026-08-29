import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const customer = {
    id: 'customer-a',
    businessId: 'business-a',
    branchId: null,
    name: 'Alice Example',
    phone: '+35699112233',
    active: true,
    email: 'alice@example.test',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    customer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new CustomersService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists one tenant with search and pagination metadata', async () => {
    prisma.customer.findMany.mockReturnValue(Promise.resolve([customer]));
    prisma.customer.count.mockReturnValue(Promise.resolve(3));
    prisma.$transaction.mockResolvedValue([[customer], 3]);

    const result = await service.list('business-a', {
      search: 'alice',
      page: 2,
      pageSize: 1,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const listInput = prisma.customer.findMany.mock.calls[0][0] as {
      where: { businessId: string };
      skip: number;
      take: number;
      orderBy: Array<Record<string, string>>;
    };
    expect(listInput.where.businessId).toBe('business-a');
    expect(listInput.skip).toBe(1);
    expect(listInput.take).toBe(1);
    expect(listInput.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(result).toEqual({
      items: [customer],
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
  });

  it('normalizes customer fields before create', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(customer);

    await service.create('business-a', {
      name: '  Alice   Example  ',
      phone: ' +356 (99) 112-233 ',
      email: ' Alice@Example.Test ',
      notes: '   ',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createInput = prisma.customer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createInput.data).toMatchObject({
      businessId: 'business-a',
      name: 'Alice Example',
      phone: '+35699112233',
      email: 'alice@example.test',
      notes: null,
    });
  });

  it('rejects an invalid normalized phone', async () => {
    await expect(
      service.create('business-a', { name: 'Alice', phone: '12-AB' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate phone found by the tenant precheck', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: customer.id });
    await expect(
      service.create('business-a', {
        name: 'Other',
        phone: '+356 99 112 233',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a Prisma P2002 race to a sanitized conflict', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create('business-a', {
        name: 'Other',
        phone: '+356 99 112 233',
      }),
    ).rejects.toThrow(new ConflictException('Customer phone already exists'));
  });

  it('rejects an empty patch', async () => {
    await expect(service.update('business-a', customer.id, {})).rejects.toThrow(
      new BadRequestException('At least one field is required'),
    );
  });

  it('returns 404 when a customer is outside the tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne('business-a', 'customer-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
