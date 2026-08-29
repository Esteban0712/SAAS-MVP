import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30_000);

interface ResourceBody {
  id: string;
  businessId: string;
  displayName?: string;
  permissions?: Array<{ code: string }>;
}

describe('Users, Roles and Permissions tenant management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const origin = 'http://localhost:5173';
  const password = process.env.DEV_SEED_PASSWORD;
  const suffix = `${process.pid}-${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  let limitedUsername: string;
  let originalAdminPasswords: Array<{ id: string; passwordHash: string }> = [];

  beforeAll(async () => {
    if (!password) {
      throw new Error('DEV_SEED_PASSWORD is required for management e2e');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
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

    originalAdminPasswords = await prisma.user.findMany({
      where: {
        username: 'admin',
        business: {
          slug: { in: ['demo-business-a', 'demo-business-b'] },
        },
      },
      select: { id: true, passwordHash: true },
    });
    if (originalAdminPasswords.length !== 2) {
      throw new Error('Admin A/B seed actors are required');
    }

    const passwordHash = await argon2.hash(password);
    await prisma.user.updateMany({
      where: { id: { in: originalAdminPasswords.map(({ id }) => id) } },
      data: { passwordHash },
    });

    const businessA = await prisma.business.findUniqueOrThrow({
      where: { slug: 'demo-business-a' },
      select: { id: true },
    });
    const employeeRole = await prisma.role.findFirstOrThrow({
      where: { businessId: businessA.id, name: 'EMPLOYEE' },
      select: { id: true },
    });
    limitedUsername = `phase-d-limited-${suffix}`;
    const limitedUser = await prisma.user.create({
      data: {
        businessId: businessA.id,
        roleId: employeeRole.id,
        username: limitedUsername,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdUserIds.push(limitedUser.id);
  });

  afterAll(async () => {
    if (app) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
      for (const admin of originalAdminPasswords) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { passwordHash: admin.passwordHash },
        });
      }
      await app.close();
    }
  });

  async function login(businessSlug: string, username = 'admin') {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ businessSlug, username, password })
      .expect(200);
    return {
      cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(
        ';',
      )[0],
      principal: response.body as AuthenticatedPrincipal,
    };
  }

  function expectNoPasswordHash(value: unknown): void {
    expect(JSON.stringify(value)).not.toContain('passwordHash');
  }

  it('scopes user listing, creation, uniqueness, roles and IDs by tenant', async () => {
    const adminA = await login('demo-business-a');
    const adminB = await login('demo-business-b');
    if (
      adminA.principal.actorType !== 'USER' ||
      adminB.principal.actorType !== 'USER'
    ) {
      throw new Error('Expected tenant principals');
    }

    const listA = await request(app.getHttpServer())
      .get('/api/users')
      .set('Cookie', adminA.cookie)
      .expect(200);
    expect(listA.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: adminA.principal.userId }),
      ]),
    );
    expect(
      (listA.body as Array<{ businessId: string }>).every(
        ({ businessId }) => businessId === adminA.principal.businessId,
      ),
    ).toBe(true);
    expectNoPasswordHash(listA.body);

    const username = `phase-d-shared-${suffix}`;
    const createA = await request(app.getHttpServer())
      .post('/api/users')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        roleId: adminA.principal.roleId,
        username,
        password,
        status: 'ACTIVE',
      })
      .expect(201);
    const createABody = createA.body as ResourceBody;
    createdUserIds.push(createABody.id);
    expect(createABody.businessId).toBe(adminA.principal.businessId);
    expectNoPasswordHash(createABody);

    const createB = await request(app.getHttpServer())
      .post('/api/users')
      .set('Origin', origin)
      .set('Cookie', adminB.cookie)
      .send({
        roleId: adminB.principal.roleId,
        username,
        password,
        status: 'ACTIVE',
      })
      .expect(201);
    const createBBody = createB.body as ResourceBody;
    createdUserIds.push(createBBody.id);
    expect(createBBody.businessId).toBe(adminB.principal.businessId);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ roleId: adminA.principal.roleId, username, password })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        roleId: adminB.principal.roleId,
        username: `phase-d-invalid-role-${suffix}`,
        password,
      })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/users/${createBBody.id}`)
      .set('Cookie', adminA.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/users/${createBBody.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ displayName: 'Cross tenant update' })
      .expect(404);

    const updateA = await request(app.getHttpServer())
      .patch(`/api/users/${createABody.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ displayName: 'Updated tenant A user' })
      .expect(200);
    const updateABody = updateA.body as ResourceBody;
    expect(updateABody.displayName).toBe('Updated tenant A user');
    expectNoPasswordHash(updateABody);
  });

  it('scopes role listing, creation, permission assignment and IDs by tenant', async () => {
    const adminA = await login('demo-business-a');
    const adminB = await login('demo-business-b');
    if (
      adminA.principal.actorType !== 'USER' ||
      adminB.principal.actorType !== 'USER'
    ) {
      throw new Error('Expected tenant principals');
    }

    const catalog = await request(app.getHttpServer())
      .get('/api/permissions')
      .set('Cookie', adminA.cookie)
      .expect(200);
    const permissions = catalog.body as Array<{ id: string; code: string }>;
    const dashboard = permissions.find(({ code }) => code === 'dashboard.view');
    const customers = permissions.find(({ code }) => code === 'customers.view');
    if (!dashboard || !customers) {
      throw new Error('Expected seeded permissions');
    }

    const roleName = `PHASE_D_${suffix}`;
    const createA = await request(app.getHttpServer())
      .post('/api/roles')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ name: roleName, permissionIds: [dashboard.id] })
      .expect(201);
    const createABody = createA.body as ResourceBody;
    createdRoleIds.push(createABody.id);
    expect(createABody.businessId).toBe(adminA.principal.businessId);

    const createB = await request(app.getHttpServer())
      .post('/api/roles')
      .set('Origin', origin)
      .set('Cookie', adminB.cookie)
      .send({ name: roleName, permissionIds: [dashboard.id] })
      .expect(201);
    const createBBody = createB.body as ResourceBody;
    createdRoleIds.push(createBBody.id);

    const listA = await request(app.getHttpServer())
      .get('/api/roles')
      .set('Cookie', adminA.cookie)
      .expect(200);
    expect(
      (listA.body as Array<{ businessId: string }>).every(
        ({ businessId }) => businessId === adminA.principal.businessId,
      ),
    ).toBe(true);
    expect(listA.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createABody.id })]),
    );

    await request(app.getHttpServer())
      .get(`/api/roles/${createBBody.id}`)
      .set('Cookie', adminA.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/roles/${createBBody.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ description: 'Cross tenant update' })
      .expect(404);

    const updateA = await request(app.getHttpServer())
      .patch(`/api/roles/${createABody.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ permissionIds: [dashboard.id, customers.id] })
      .expect(200);
    const updateABody = updateA.body as ResourceBody;
    expect(updateABody.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'dashboard.view' }),
        expect.objectContaining({ code: 'customers.view' }),
      ]),
    );
  });

  it('exposes the read-only permission catalog only with roles.view', async () => {
    const adminA = await login('demo-business-a');
    const catalog = await request(app.getHttpServer())
      .get('/api/permissions')
      .set('Cookie', adminA.cookie)
      .expect(200);
    expect(catalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'users.view' }),
        expect.objectContaining({ code: 'roles.view' }),
      ]),
    );

    const limited = await login('demo-business-a', limitedUsername);
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Cookie', limited.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/permissions')
      .set('Cookie', limited.cookie)
      .expect(403);
  });
});
