const MINIMUM_JWT_SECRET_LENGTH = 32;

export function parseDurationMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error('JWT_EXPIRES_IN must be a positive duration');

  const amount = Number(match[1]);
  const factors = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const milliseconds = amount * factors[match[2] as keyof typeof factors];
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration');
  }
  return milliseconds;
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const readString = (key: string, fallback = ''): string => {
    const value = environment[key] ?? fallback;
    if (typeof value !== 'string') throw new Error(`${key} must be a string`);
    return value;
  };
  const nodeEnv = readString('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const secret = readString('JWT_SECRET');
  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must contain at least ${MINIMUM_JWT_SECRET_LENGTH} characters`,
    );
  }

  const frontendUrl = readString('FRONTEND_URL');
  let origin: URL;
  try {
    origin = new URL(frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid absolute HTTP(S) origin');
  }
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== frontendUrl ||
    origin.username ||
    origin.password
  ) {
    throw new Error('FRONTEND_URL must be a valid absolute HTTP(S) origin');
  }
  if (nodeEnv === 'production' && origin.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must use HTTPS in production');
  }

  const expiresIn = readString('JWT_EXPIRES_IN', '8h');
  parseDurationMilliseconds(expiresIn);

  for (const [key, fallback] of [
    ['LOGIN_RATE_LIMIT_MAX', '10'],
    ['LOGIN_RATE_LIMIT_WINDOW_MS', '60000'],
    ['TRUST_PROXY_HOPS', '0'],
  ] as const) {
    const value = Number(environment[key] ?? fallback);
    const valid =
      key === 'TRUST_PROXY_HOPS'
        ? Number.isSafeInteger(value) && value >= 0 && value <= 10
        : Number.isSafeInteger(value) && value > 0;
    if (!valid) {
      throw new Error(`${key} has an invalid value`);
    }
  }
  if (
    nodeEnv === 'production' &&
    Number(environment.TRUST_PROXY_HOPS ?? 0) < 1
  ) {
    throw new Error('TRUST_PROXY_HOPS must trust the production reverse proxy');
  }

  return {
    ...environment,
    NODE_ENV: nodeEnv,
    FRONTEND_URL: frontendUrl,
    JWT_EXPIRES_IN: expiresIn,
  };
}
