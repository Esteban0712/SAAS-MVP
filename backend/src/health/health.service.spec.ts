import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const service = new HealthService(prisma);

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('reports the API and database as healthy', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a sanitized service unavailable error when the database fails', async () => {
    queryRaw.mockRejectedValue(new Error('Sensitive driver failure details'));

    await expect(service.check()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'error',
        database: 'unavailable',
        message: 'Database unavailable',
      },
    } satisfies Partial<ServiceUnavailableException>);
  });
});
