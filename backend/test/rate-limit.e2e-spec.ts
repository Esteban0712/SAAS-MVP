import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { LoginRateLimitService } from '../src/auth/login-rate-limit.service';

describe('Login rate limit (e2e)', () => {
  let app: INestApplication<App>;
  const origin = 'http://localhost:5173';

  beforeAll(async () => {
    const limiterConfig = {
      get: (key: string, fallback: string) =>
        key === 'LOGIN_RATE_LIMIT_MAX'
          ? '2'
          : key === 'LOGIN_RATE_LIMIT_WINDOW_MS'
            ? '2000'
            : fallback,
    };
    const limiter = new LoginRateLimitService(
      limiterConfig as unknown as ConfigService,
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LoginRateLimitService)
      .useValue(limiter)
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApplication(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    [
      '/api/auth/login',
      { businessSlug: 'missing', username: 'missing', password: 'incorrect' },
    ],
    [
      '/api/platform/auth/login',
      { username: 'missing', password: 'incorrect' },
    ],
  ])('limits %s and recovers after the window', async (path, body) => {
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .send(body)
      .expect(401);
    const limited = await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .send(body)
      .expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    await new Promise((resolve) => setTimeout(resolve, 2_125));
    await request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .send(body)
      .expect(401);
  });
});
