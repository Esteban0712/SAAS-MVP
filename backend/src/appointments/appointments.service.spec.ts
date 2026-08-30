import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import { TimezoneService } from './timezone.service';
describe('AppointmentsService', () => {
  const prisma = {
    appointment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    business: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AppointmentsService(
    prisma as unknown as PrismaService,
    {} as AvailabilityService,
    new TimezoneService(),
  );
  it('rejects list ranges over 31 days', async () => {
    await expect(
      service.list('b1', {
        from: '2026-01-01T00:00:00Z',
        to: '2026-03-01T00:00:00Z',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('returns the authenticated tenant timezone without changing list metadata', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.appointment.count.mockResolvedValue(0);
    prisma.business.findUnique.mockResolvedValue({ timezone: 'Europe/Malta' });
    prisma.$transaction.mockImplementation(
      (operations: Array<Promise<unknown>>) => Promise.all(operations),
    );
    await expect(
      service.list('b1', {
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      timezone: 'Europe/Malta',
    });
    expect(prisma.business.findUnique).toHaveBeenCalledWith({
      where: { id: 'b1' },
      select: { timezone: true },
    });
  });
  it('rejects an invalid terminal status transition before update', async () => {
    prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      Promise.resolve(
        work({
          $queryRaw: jest
            .fn()
            .mockResolvedValue([
              { id: 'a', status: AppointmentStatus.COMPLETED },
            ]),
        }),
      ),
    );
    await expect(
      service.update('b1', 'u1', 'a', {
        action: 'STATUS' as never,
        status: AppointmentStatus.CONFIRMED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
