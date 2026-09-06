import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApplication } from '../src/app.setup';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let originalTenantPassword: { id: string; passwordHash: string } | undefined;
  let originalPlatformPassword:
    { id: string; passwordHash: string } | undefined;
  const frontendOrigin = 'http://localhost:5173';
  const password = process.env.DEV_SEED_PASSWORD;

  beforeAll(async () => {
    if (!password) {
      throw new Error('DEV_SEED_PASSWORD is required for auth e2e tests');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApplication(app, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    originalTenantPassword =
      (await prisma.user.findFirst({
        where: {
          username: 'admin',
          business: { slug: 'demo-business-a' },
        },
        select: { id: true, passwordHash: true },
      })) ?? undefined;
    originalPlatformPassword =
      (await prisma.platformUser.findUnique({
        where: { username: 'platform_admin' },
        select: { id: true, passwordHash: true },
      })) ?? undefined;
    if (!originalTenantPassword || !originalPlatformPassword) {
      throw new Error('Auth e2e seed actors are required');
    }

    const passwordHash = await argon2.hash(password);
    await prisma.user.update({
      where: { id: originalTenantPassword.id },
      data: { passwordHash },
    });
    await prisma.platformUser.update({
      where: { id: originalPlatformPassword.id },
      data: { passwordHash },
    });
  }, 30_000);

  afterAll(async () => {
    if (app) {
      if (originalTenantPassword) {
        await prisma.user.update({
          where: { id: originalTenantPassword.id },
          data: { passwordHash: originalTenantPassword.passwordHash },
        });
      }
      if (originalPlatformPassword) {
        await prisma.platformUser.update({
          where: { id: originalPlatformPassword.id },
          data: { passwordHash: originalPlatformPassword.passwordHash },
        });
      }
      await app.close();
    }
  }, 30_000);

  it('logs in, sets a cookie, resolves me and logs out', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', frontendOrigin)
      .send({
        businessSlug: 'demo-business-a',
        username: 'admin',
        password,
      })
      .expect(200);

    expect(login.body).toMatchObject({
      actorType: 'USER',
      username: 'admin',
    });
    expect(login.body).not.toHaveProperty('passwordHash');
    const setCookie = login.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).toContain('deenova_session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');
    expect(setCookie[0]).toContain('Path=/api');
    const cookie = setCookie[0].split(';')[0];

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          actorType: 'USER',
          username: 'admin',
        });
        expect(body).not.toHaveProperty('passwordHash');
      });

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', frontendOrigin)
      .set('Cookie', cookie)
      .expect(204);
    expect(logout.headers['set-cookie'][0]).toContain('deenova_session=;');
  });

  it('rejects invalid tenant credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', frontendOrigin)
      .send({
        businessSlug: 'demo-business-a',
        username: 'admin',
        password: `${password}-incorrect`,
      })
      .expect(401);
  });

  it('rejects an anonymous me request', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rejects invalid and expired session tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'deenova_session=not-a-valid-jwt')
      .expect(401);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: originalTenantPassword!.id },
      select: { businessId: true },
    });
    const expired = await jwt.signAsync(
      {
        sub: originalTenantPassword!.id,
        actorType: 'USER',
        businessId: user.businessId,
      },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `deenova_session=${expired}`)
      .expect(401);
  });

  it('logs in a platform actor without exposing a businessId', async () => {
    await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .set('Origin', frontendOrigin)
      .send({ username: 'platform_admin', password })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          actorType: 'PLATFORM',
          username: 'platform_admin',
        });
        expect(body).not.toHaveProperty('businessId');
        expect(body).not.toHaveProperty('passwordHash');
      });
  });

  it('rejects a mutation from an untrusted origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'https://untrusted.example')
      .expect(403);
  });

  it('sets security headers and rejects oversized JSON bodies', async () => {
    const health = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('DENY');
    expect(health.headers['content-security-policy']).toBeUndefined();
    expect(health.headers['x-powered-by']).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', frontendOrigin)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(300 * 1024) }))
      .expect(413);
  });
});
