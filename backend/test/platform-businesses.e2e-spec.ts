import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

jest.setTimeout(60_000);

describe('Platform businesses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let platformCookie: string;
  let tenantCookie: string;
  let businessId: string | undefined;
  let originalPlatformPassword: { id: string; passwordHash: string };
  let originalTenantPassword: { id: string; passwordHash: string };
  const origin = 'http://localhost:5173';
  const password = process.env.DEV_SEED_PASSWORD;
  const suffix = `${process.pid}-${Date.now()}`;
  const slug = `platform-e2e-${suffix}`;
  const adminPassword = 'Initial-Strong1!';

  beforeAll(async () => {
    if (!password)
      throw new Error(
        'DEV_SEED_PASSWORD is required for platform businesses e2e',
      );
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    originalPlatformPassword = await prisma.platformUser.findUniqueOrThrow({
      where: { username: 'platform_admin' },
      select: { id: true, passwordHash: true },
    });
    await prisma.platformUser.update({
      where: { id: originalPlatformPassword.id },
      data: { passwordHash: await argon2.hash(password) },
    });
    originalTenantPassword = await prisma.user.findFirstOrThrow({
      where: { username: 'admin', business: { slug: 'demo-business-a' } },
      select: { id: true, passwordHash: true },
    });
    await prisma.user.update({
      where: { id: originalTenantPassword.id },
      data: { passwordHash: await argon2.hash(password) },
    });
    const login = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .set('Origin', origin)
      .send({ username: 'platform_admin', password })
      .expect(200);
    platformCookie = (
      login.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
  });

  afterAll(async () => {
    if (app) {
      if (businessId) {
        await prisma.auditLog.deleteMany({ where: { businessId } });
        await prisma.user.deleteMany({ where: { businessId } });
        await prisma.rolePermission.deleteMany({
          where: { role: { businessId } },
        });
        await prisma.role.deleteMany({ where: { businessId } });
        await prisma.branch.deleteMany({ where: { businessId } });
        await prisma.business
          .delete({ where: { id: businessId } })
          .catch(() => undefined);
      }
      await prisma.platformUser.update({
        where: { id: originalPlatformPassword.id },
        data: { passwordHash: originalPlatformPassword.passwordHash },
      });
      await prisma.user.update({
        where: { id: originalTenantPassword.id },
        data: { passwordHash: originalTenantPassword.passwordHash },
      });
      await app.close();
    }
  });

  it('enforces authentication and the platform boundary', async () => {
    await request(app.getHttpServer())
      .get('/api/platform/businesses')
      .expect(401);
    const tenantLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ businessSlug: 'demo-business-a', username: 'admin', password })
      .expect(200);
    const cookie = (
      tenantLogin.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    await request(app.getHttpServer())
      .get('/api/platform/businesses')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('creates the complete graph, normalized slug and audit atomically', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/platform/businesses')
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({
        name: ` Platform Business ${suffix} `,
        slug: `  Plátform E2E ${suffix} `,
        timezone: 'Europe/Malta',
        currency: 'eur',
        maxUsers: 25,
        branch: { name: ' Main Branch ' },
        admin: {
          username: 'admin',
          password: adminPassword,
          email: `ADMIN-${suffix}@example.test`,
          displayName: 'Initial Admin',
        },
      })
      .expect(201);
    businessId = response.body.id as string;
    expect(response.body).toMatchObject({
      slug,
      status: 'ACTIVE',
      currency: 'EUR',
    });
    expect(response.body.summary).toMatchObject({ branches: 1, users: 1 });
    expect(response.body.settingsJson).toBeNull();
    expect(response.body).not.toHaveProperty('passwordHash');

    const [branch, role, user, permissionCount, audit] = await Promise.all([
      prisma.branch.findFirstOrThrow({ where: { businessId } }),
      prisma.role.findFirstOrThrow({
        where: { businessId, name: 'ADMIN' },
        include: { permissions: true },
      }),
      prisma.user.findFirstOrThrow({
        where: { businessId, username: 'admin' },
      }),
      prisma.permission.count(),
      prisma.auditLog.findFirstOrThrow({
        where: { businessId, action: 'BUSINESS_CREATED' },
      }),
    ]);
    expect(branch).toMatchObject({ isMain: true, active: true });
    expect(role).toMatchObject({ active: true, isSystemDefault: true });
    expect(role.permissions).toHaveLength(permissionCount);
    expect(user).toMatchObject({
      status: 'ACTIVE',
      mustChangePassword: true,
      isOwner: true,
    });
    expect(await argon2.verify(user.passwordHash, adminPassword)).toBe(true);
    expect(audit.platformUserId).toBe(originalPlatformPassword.id);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ businessSlug: slug, username: 'admin', password: adminPassword })
      .expect(200);
    tenantCookie = (
      login.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
  });

  it('validates timezone/password, sanitizes conflicts and keeps update fields whitelisted', async () => {
    const base = {
      name: 'Invalid',
      slug: `invalid-${suffix}`,
      currency: 'EUR',
      maxUsers: 2,
      branch: { name: 'Main' },
      admin: { username: 'admin', password: 'weak-password' },
    };
    await request(app.getHttpServer())
      .post('/api/platform/businesses')
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({ ...base, timezone: 'GMT+2' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/platform/businesses')
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({ ...base, timezone: 'Europe/Malta' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/platform/businesses')
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({
        ...base,
        slug,
        timezone: 'Europe/Malta',
        admin: { ...base.admin, password: adminPassword },
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.message).toBe('Business slug already exists'),
      );
    await request(app.getHttpServer())
      .patch(`/api/platform/businesses/${businessId}`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({ status: 'SUSPENDED' })
      .expect(400);
  });

  it('lists with search/status/pagination and returns detail counts', async () => {
    const list = await request(app.getHttpServer())
      .get(
        `/api/platform/businesses?search=${encodeURIComponent(slug.toUpperCase())}&status=ACTIVE&page=1&pageSize=1`,
      )
      .set('Cookie', platformCookie)
      .expect(200);
    expect(list.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(list.body.items[0]).toMatchObject({ id: businessId, slug });
    expect(list.body.items[0]).not.toHaveProperty('summary');

    const detail = await request(app.getHttpServer())
      .get(`/api/platform/businesses/${businessId}`)
      .set('Cookie', platformCookie)
      .expect(200);
    expect(detail.body.branches).toHaveLength(1);
    expect(detail.body.summary).toMatchObject({
      branches: 1,
      users: 1,
      customers: 0,
      employees: 0,
      services: 0,
      appointments: 0,
      sales: 0,
    });
    await request(app.getHttpServer())
      .get('/api/platform/businesses/00000000-0000-4000-8000-000000000000')
      .set('Cookie', platformCookie)
      .expect(404);
  });

  it('updates allowed fields and records audit', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/platform/businesses/${businessId}`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({
        name: ' Updated Business ',
        timezone: 'America/New_York',
        currency: 'usd',
        maxUsers: 30,
        phone: ' +1 555 ',
      })
      .expect(200);
    expect(response.body).toMatchObject({
      name: 'Updated Business',
      timezone: 'America/New_York',
      currency: 'USD',
      maxUsers: 30,
    });
    expect(
      await prisma.auditLog.count({
        where: { businessId, action: 'BUSINESS_UPDATED' },
      }),
    ).toBe(1);
  });

  it('suspends without deleting data, immediately blocks and then restores tenant access', async () => {
    await request(app.getHttpServer())
      .post(`/api/platform/businesses/${businessId}/suspend`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('SUSPENDED'));
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', tenantCookie)
      .expect(401);
    expect(await prisma.branch.count({ where: { businessId } })).toBe(1);
    expect(await prisma.user.count({ where: { businessId } })).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/platform/businesses/${businessId}/suspend`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/platform/businesses/${businessId}/reactivate`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('ACTIVE'));
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', tenantCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/platform/businesses/${businessId}/reactivate`)
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .expect(409);
    expect(
      await prisma.auditLog.count({
        where: {
          businessId,
          action: { in: ['BUSINESS_SUSPENDED', 'BUSINESS_REACTIVATED'] },
        },
      }),
    ).toBe(2);
  });
});
