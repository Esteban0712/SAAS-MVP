import { ConfigService } from '@nestjs/config';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('LoginRateLimitService', () => {
  const config = {
    get: jest.fn((key: string, fallback: string) =>
      key === 'LOGIN_RATE_LIMIT_MAX'
        ? '2'
        : key === 'LOGIN_RATE_LIMIT_WINDOW_MS'
          ? '1000'
          : fallback,
    ),
  };
  const service = new LoginRateLimitService(config as unknown as ConfigService);

  it('limits attempts and recovers after the configured window', () => {
    expect(service.consume('tenant:ip', 1_000)).toBeNull();
    expect(service.consume('tenant:ip', 1_001)).toBeNull();
    expect(service.consume('tenant:ip', 1_002)).toBe(1);
    expect(service.consume('tenant:ip', 2_000)).toBeNull();
  });

  it('keeps tenant and platform login buckets independent', () => {
    expect(service.consume('platform:ip', 3_000)).toBeNull();
    expect(service.consume('tenant-other:ip', 3_000)).toBeNull();
  });
});
