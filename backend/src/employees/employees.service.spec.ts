/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const employee = {
    id: 'e1',
    businessId: 'b1',
    branchId: 'br1',
    userId: null,
    displayName: 'Alice',
    active: true,
    phone: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: { id: 'br1', name: 'Main', isMain: true, active: true },
  };
  const tx = {
    employeeService: { deleteMany: jest.fn(), createMany: jest.fn() },
    employeeSchedule: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    service: { count: jest.fn() },
    employeeService: { findMany: jest.fn() },
    employeeSchedule: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new EmployeesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.$transaction.mockImplementation((input: unknown) =>
      Promise.resolve(
        typeof input === 'function'
          ? (input as (value: typeof tx) => unknown)(tx)
          : input,
      ),
    );
  });

  it('scopes list and returns Customers-compatible metadata', async () => {
    prisma.$transaction.mockResolvedValue([[employee], 2]);
    const result = await service.list('b1', {
      search: 'ali',
      page: 1,
      pageSize: 1,
    });
    expect(prisma.employee.findMany.mock.calls[0][0]).toMatchObject({
      where: { businessId: 'b1' },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    expect(result).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('validates branch tenant and normalizes create', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'br1' });
    prisma.employee.create.mockResolvedValue(employee);
    await service.create('b1', {
      branchId: 'br1',
      displayName: ' Alice   Doe ',
      phone: ' ',
      notes: ' note ',
    });
    expect(prisma.employee.create.mock.calls[0][0].data).toMatchObject({
      businessId: 'b1',
      displayName: 'Alice Doe',
      phone: null,
      notes: 'note',
    });
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(
      service.create('b1', { branchId: 'foreign', displayName: 'A' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces services atomically and rejects foreign IDs', async () => {
    prisma.service.count.mockResolvedValue(2);
    prisma.employeeService.findMany.mockResolvedValue([]);
    await service.replaceServices('b1', 'e1', ['s1', 's2']);
    expect(tx.employeeService.deleteMany).toHaveBeenCalled();
    expect(tx.employeeService.createMany).toHaveBeenCalled();
    prisma.service.count.mockResolvedValue(1);
    await expect(
      service.replaceServices('b1', 'e1', ['s1', 'foreign']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts adjacent schedule blocks and canonicalizes TIME', async () => {
    prisma.employeeSchedule.findMany.mockResolvedValue([]);
    await service.replaceSchedules('b1', 'e1', [
      { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '12:00' },
      {
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '12:00:00',
        endTime: '17:00:00',
      },
    ]);
    const data = tx.employeeSchedule.createMany.mock.calls[0][0].data as Array<{
      startTime: Date;
    }>;
    expect(data[0].startTime.toISOString()).toContain('09:00:00');
  });

  it('rejects reversed and overlapping schedules before transaction', async () => {
    await expect(
      service.replaceSchedules('b1', 'e1', [
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '12:00', endTime: '09:00' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replaceSchedules('b1', 'e1', [
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '11:00', endTime: '13:00' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
