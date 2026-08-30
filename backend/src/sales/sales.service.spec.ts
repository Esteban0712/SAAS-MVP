import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const prisma = { $transaction: jest.fn() };
  const service = new SalesService(prisma as unknown as PrismaService);

  it('rejects a non-positive payment before opening a transaction', async () => {
    await expect(
      service.addPayment('business', 'user', 'sale', {
        method: PaymentMethod.CASH,
        amount: '0.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a manual sale without branch/items atomically', async () => {
    prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      Promise.resolve(work({})),
    );
    await expect(service.create('business', 'user', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
