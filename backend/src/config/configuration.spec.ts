import {
  parseDurationMilliseconds,
  validateEnvironment,
} from './configuration';

describe('configuration validation', () => {
  const valid = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-secure-random-secret-with-32-characters',
    FRONTEND_URL: 'https://app.example.com',
    JWT_EXPIRES_IN: '30m',
    TRUST_PROXY_HOPS: '1',
  };

  it('accepts secure production configuration and parses JWT duration', () => {
    expect(validateEnvironment(valid)).toMatchObject(valid);
    expect(parseDurationMilliseconds('30m')).toBe(1_800_000);
  });

  it.each([
    [{ ...valid, JWT_SECRET: 'short' }, 'JWT_SECRET'],
    [
      { ...valid, FRONTEND_URL: 'https://app.example.com/path' },
      'FRONTEND_URL',
    ],
    [{ ...valid, FRONTEND_URL: 'http://app.example.com' }, 'HTTPS'],
    [{ ...valid, JWT_EXPIRES_IN: 'forever' }, 'JWT_EXPIRES_IN'],
    [{ ...valid, LOGIN_RATE_LIMIT_MAX: '0' }, 'LOGIN_RATE_LIMIT_MAX'],
    [{ ...valid, TRUST_PROXY_HOPS: '0' }, 'TRUST_PROXY_HOPS'],
  ])('rejects invalid critical configuration', (input, message) => {
    expect(() => validateEnvironment(input)).toThrow(message);
  });
});
