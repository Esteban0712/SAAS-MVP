import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(60_000);

interface CustomerBody {
  id: string;
  businessId: string;
  branchId: string | null;
  name: string;
  phone: string;
  active: boolean;
  email: string | null;
  notes: string | null;
}

describe('Customers tenant management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const origin = 'http://localhost:5173';
  const password = process.env.DEV_SEED_PASSWORD;
  const suffix = `${process.pid}-${Date.now()}`;
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];
  let originalAdminPasswords: Array<{ id: string; passwordHash: string }> = [];
  let viewerUsername: string;
  let noPermissionUsername: string;
  let customerA: CustomerBody;
  let customerB: CustomerBody;

  beforeAll(async () => {
    if (!password) {
      throw new Error('DEV_SEED_PASSWORD is required for customers e2e');
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
    viewerUsername = `customer-viewer-${suffix}`;
    const viewer = await prisma.user.create({
      data: {
        businessId: businessA.id,
        roleId: employeeRole.id,
        username: viewerUsername,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdUserIds.push(viewer.id);

    const noPermissionRole = await prisma.role.create({
      data: { businessId: businessA.id, name: `CUSTOMER_NONE_${suffix}` },
      select: { id: true },
    });
    createdRoleIds.push(noPermissionRole.id);
    noPermissionUsername = `customer-none-${suffix}`;
    const noPermissionUser = await prisma.user.create({
      data: {
        businessId: businessA.id,
        roleId: noPermissionRole.id,
        username: noPermissionUsername,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdUserIds.push(noPermissionUser.id);
  });

  afterAll(async () => {
    if (app) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      });
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

  it('creates normalized customers and permits the same phone across A/B', async () => {
    const adminA = await login('demo-business-a');
    const adminB = await login('demo-business-b');
    if (
      adminA.principal.actorType !== 'USER' ||
      adminB.principal.actorType !== 'USER'
    ) {
      throw new Error('Expected tenant principals');
    }
    const phone = `+356 77 ${suffix.slice(-3)} 1234`;

    const responseA = await request(app.getHttpServer())
      .post('/api/customers?businessId=ignored')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .set('x-business-id', adminB.principal.businessId)
      .send({
        name: '  Alice   Customer  ',
        phone,
        email: ' Alice@Example.Test ',
        notes: '  First customer  ',
      })
      .expect(201);
    customerA = responseA.body as CustomerBody;
    createdCustomerIds.push(customerA.id);
    expect(customerA).toMatchObject({
      businessId: adminA.principal.businessId,
      branchId: null,
      name: 'Alice Customer',
      email: 'alice@example.test',
      notes: 'First customer',
    });
    expect(customerA.phone).not.toMatch(/[\s().-]/);
    expect(responseA.body).not.toHaveProperty('business');
    expect(responseA.body).not.toHaveProperty('appointments');

    const responseB = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminB.cookie)
      .send({ name: 'Business B Customer', phone })
      .expect(201);
    customerB = responseB.body as CustomerBody;
    createdCustomerIds.push(customerB.id);
    expect(customerB.businessId).toBe(adminB.principal.businessId);
    expect(customerB.phone).toBe(customerA.phone);
  });

  it('lists only the tenant and supports name, phone, email and pagination', async () => {
    const adminA = await login('demo-business-a');
    if (adminA.principal.actorType !== 'USER') {
      throw new Error('Expected tenant principal');
    }
    const second = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        name: `Zulu Search ${suffix}`,
        phone: `+356 78 ${suffix.slice(-3)} 5678`,
        email: `Zulu-${suffix}@Example.Test`,
      })
      .expect(201);
    createdCustomerIds.push((second.body as CustomerBody).id);

    for (const search of [
      'ALICE CUSTOMER',
      customerA.phone.slice(-5),
      'ALICE@EXAMPLE.TEST',
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/customers?search=${encodeURIComponent(search)}`)
        .set('Cookie', adminA.cookie)
        .expect(200);
      const body = response.body as {
        items: CustomerBody[];
        total: number;
      };
      expect(body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: customerA.id })]),
      );
      expect(
        body.items.every((item) => item.businessId === customerA.businessId),
      ).toBe(true);
      expect(body.items.some((item) => item.id === customerB.id)).toBe(false);
    }

    const page = await request(app.getHttpServer())
      .get('/api/customers?page=1&pageSize=1')
      .set('Cookie', adminA.cookie)
      .expect(200);
    const pageBody = page.body as {
      items: CustomerBody[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(pageBody).toMatchObject({ page: 1, pageSize: 1 });
    expect(pageBody.items).toHaveLength(1);
    expect(pageBody.total).toBeGreaterThanOrEqual(2);
    expect(pageBody.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('gets and updates details, active state and nullable fields', async () => {
    const adminA = await login('demo-business-a');
    await request(app.getHttpServer())
      .get(`/api/customers/${customerA.id}`)
      .set('Cookie', adminA.cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: customerA.id, active: true });
      });

    const update = await request(app.getHttpServer())
      .patch(`/api/customers/${customerA.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        name: '  Alice   Updated  ',
        email: '   ',
        notes: '',
        active: false,
      })
      .expect(200);
    expect(update.body).toMatchObject({
      name: 'Alice Updated',
      email: null,
      notes: null,
      active: false,
    });
  });

  it('returns validation errors and a sanitized duplicate conflict', async () => {
    const adminA = await login('demo-business-a');
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ name: 'Duplicate', phone: customerA.phone })
      .expect(409)
      .expect(({ body }) => {
        const error = body as { message: string };
        expect(error.message).toBe('Customer phone already exists');
        expect(JSON.stringify(error)).not.toContain('P2002');
      });
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ name: 'Invalid', phone: '12-AB' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/customers/${customerA.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        name: 'Injected tenant',
        phone: `+35679${suffix.slice(-7)}`,
        businessId: customerB.businessId,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({
        name: 'Injected branch',
        phone: `+35676${suffix.slice(-7)}`,
        branchId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
  });

  it('returns 404 for cross-tenant detail and update', async () => {
    const adminA = await login('demo-business-a');
    await request(app.getHttpServer())
      .get(`/api/customers/${customerB.id}`)
      .set('Cookie', adminA.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/customers/${customerB.id}`)
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .send({ name: 'Cross tenant edit' })
      .expect(404);
  });

  it('enforces customers.view and customers.manage separately', async () => {
    const viewer = await login('demo-business-a', viewerUsername);
    await request(app.getHttpServer())
      .get('/api/customers')
      .set('Cookie', viewer.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', viewer.cookie)
      .send({ name: 'Forbidden', phone: '+35679000001' })
      .expect(403);

    const noPermission = await login('demo-business-a', noPermissionUsername);
    await request(app.getHttpServer())
      .get('/api/customers')
      .set('Cookie', noPermission.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Origin', origin)
      .set('Cookie', noPermission.cookie)
      .send({ name: 'Forbidden', phone: '+35679000002' })
      .expect(403);
  });
});
