import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('should report an ok status', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });
});
