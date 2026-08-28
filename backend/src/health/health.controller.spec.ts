import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const healthService = {
    check: jest.fn().mockResolvedValue({ status: 'ok', database: 'ok' }),
  } as unknown as HealthService;
  const controller = new HealthController(healthService);

  it('delegates the health check to the service', async () => {
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });
});
