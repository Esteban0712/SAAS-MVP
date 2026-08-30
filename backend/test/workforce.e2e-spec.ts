/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(90_000);

describe('Employees and Services tenant management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = process.env.DEV_SEED_PASSWORD;
  const origin = 'http://localhost:5173';
  const suffix = `${process.pid}-${Date.now()}`;
  let businessA: string, businessB: string, branchA: string, branchB: string;
  let employeeA: string, employeeB: string, serviceA: string, serviceB: string;
  let viewerUsername: string, noneUsername: string;
  const userIds: string[] = [],
    roleIds: string[] = [],
    branchIds: string[] = [],
    employeeIds: string[] = [],
    serviceIds: string[] = [];
  let originalPasswords: Array<{ id: string; passwordHash: string }> = [];

  beforeAll(async () => {
    if (!password)
      throw new Error('DEV_SEED_PASSWORD is required for workforce e2e');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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
    const businesses = await prisma.business.findMany({
      where: { slug: { in: ['demo-business-a', 'demo-business-b'] } },
      select: { id: true, slug: true },
    });
    businessA = businesses.find((b) => b.slug === 'demo-business-a')!.id;
    businessB = businesses.find((b) => b.slug === 'demo-business-b')!.id;
    originalPasswords = await prisma.user.findMany({
      where: { businessId: { in: [businessA, businessB] }, username: 'admin' },
      select: { id: true, passwordHash: true },
    });
    const passwordHash = await argon2.hash(password);
    await prisma.user.updateMany({
      where: { id: { in: originalPasswords.map((u) => u.id) } },
      data: { passwordHash },
    });
    const branches = await Promise.all([
      prisma.branch.create({
        data: { businessId: businessA, name: `Main A ${suffix}`, isMain: true },
      }),
      prisma.branch.create({
        data: { businessId: businessB, name: `Main B ${suffix}`, isMain: true },
      }),
    ]);
    branchA = branches[0].id;
    branchB = branches[1].id;
    branchIds.push(branchA, branchB);
    const permissions = await prisma.permission.findMany({
      where: { code: { in: ['employees.view', 'services.view'] } },
      select: { id: true },
    });
    const viewerRole = await prisma.role.create({
      data: {
        businessId: businessA,
        name: `WORKFORCE_VIEW_${suffix}`,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
    });
    const noneRole = await prisma.role.create({
      data: { businessId: businessA, name: `WORKFORCE_NONE_${suffix}` },
    });
    roleIds.push(viewerRole.id, noneRole.id);
    viewerUsername = `workforce-view-${suffix}`;
    noneUsername = `workforce-none-${suffix}`;
    for (const input of [
      { username: viewerUsername, roleId: viewerRole.id },
      { username: noneUsername, roleId: noneRole.id },
    ]) {
      const user = await prisma.user.create({
        data: {
          businessId: businessA,
          ...input,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      userIds.push(user.id);
    }
  });

  afterAll(async () => {
    if (app) {
      await prisma.employeeSchedule.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.employeeService.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
      for (const user of originalPasswords)
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: user.passwordHash },
        });
      await app.close();
    }
  });

  async function login(slug: string, username = 'admin') {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ businessSlug: slug, username, password })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  }

  it('rejects anonymous access and exposes only tenant branches', async () => {
    await request(app.getHttpServer()).get('/api/employees').expect(401);
    const cookie = await login('demo-business-a');
    const response = await request(app.getHttpServer())
      .get('/api/employees/branches')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: branchA,
          name: `Main A ${suffix}`,
          isMain: true,
          active: true,
        }),
      ]),
    );
    expect(response.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: branchB })]),
    );
  });

  it('creates, lists, searches and updates employees and services per tenant', async () => {
    const a = await login('demo-business-a'),
      b = await login('demo-business-b');
    const employeeResponse = await request(app.getHttpServer())
      .post('/api/employees?businessId=ignored')
      .set('Origin', origin)
      .set('x-business-id', businessB)
      .set('Cookie', a)
      .send({
        displayName: '  Alice   Worker ',
        branchId: branchA,
        phone: ' 123 ',
        notes: '  note ',
        businessId: businessB,
      })
      .expect(400);
    expect(employeeResponse.body.statusCode).toBe(400);
    const createdEmployee = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Origin', origin)
      .set('x-business-id', businessB)
      .set('Cookie', a)
      .send({
        displayName: '  Alice   Worker ',
        branchId: branchA,
        phone: ' 123 ',
        notes: '  note ',
      })
      .expect(201);
    employeeA = createdEmployee.body.id;
    employeeIds.push(employeeA);
    expect(createdEmployee.body).toMatchObject({
      businessId: businessA,
      displayName: 'Alice Worker',
      branchId: branchA,
      userId: null,
      phone: '123',
      notes: 'note',
    });
    const eb = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Origin', origin)
      .set('Cookie', b)
      .send({ displayName: 'Worker B', branchId: branchB })
      .expect(201);
    employeeB = eb.body.id;
    employeeIds.push(employeeB);
    const sa = await request(app.getHttpServer())
      .post('/api/services')
      .set('Origin', origin)
      .set('Cookie', a)
      .send({
        name: '  Hair   Cut ',
        durationMinutes: 30,
        price: '25',
        category: ' Hair ',
      })
      .expect(201);
    serviceA = sa.body.id;
    serviceIds.push(serviceA);
    expect(sa.body).toMatchObject({
      businessId: businessA,
      name: 'Hair Cut',
      price: '25.00',
      category: 'Hair',
    });
    const sb = await request(app.getHttpServer())
      .post('/api/services')
      .set('Origin', origin)
      .set('Cookie', b)
      .send({ name: 'Service B', durationMinutes: 60, price: '10.10' })
      .expect(201);
    serviceB = sb.body.id;
    serviceIds.push(serviceB);
    for (const [path, term] of [
      ['employees', 'ALICE'],
      ['services', 'HAIR'],
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/${path}?search=${term}&page=1&pageSize=1`)
        .set('Cookie', a)
        .expect(200);
      expect(response.body).toMatchObject({
        page: 1,
        pageSize: 1,
        totalPages: 1,
      });
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].businessId).toBe(businessA);
    }
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeA}`)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ active: false, displayName: 'Alice Updated' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          active: false,
          displayName: 'Alice Updated',
        }),
      );
    await request(app.getHttpServer())
      .patch(`/api/services/${serviceA}`)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ price: '26.5', active: false })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ price: '26.50', active: false }),
      );
  });

  it('rejects cross-tenant IDs, invalid branches, empty patches, price and duration', async () => {
    const a = await login('demo-business-a');
    for (const path of [`employees/${employeeB}`, `services/${serviceB}`]) {
      await request(app.getHttpServer())
        .get(`/api/${path}`)
        .set('Cookie', a)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/${path}`)
        .set('Origin', origin)
        .set('Cookie', a)
        .send({ active: false })
        .expect(404);
    }
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ displayName: 'Foreign', branchId: branchB })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeA}`)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/services/${serviceA}`)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({})
      .expect(400);
    for (const body of [
      { name: 'Bad', durationMinutes: 0, price: '1.00' },
      { name: 'Bad', durationMinutes: 30, price: '-1' },
      { name: 'Bad', durationMinutes: 30, price: '1.999' },
      { name: 'Bad', durationMinutes: 1441, price: '1' },
    ])
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Origin', origin)
        .set('Cookie', a)
        .send(body)
        .expect(400);
  });

  it('replaces assigned services idempotently, validates IDs and supports empty', async () => {
    const a = await login('demo-business-a');
    const path = `/api/employees/${employeeA}/services`;
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer())
        .put(path)
        .set('Origin', origin)
        .set('Cookie', a)
        .send({ serviceIds: [serviceA] })
        .expect(200);
      expect(response.body).toEqual([
        expect.objectContaining({ id: serviceA, price: '26.50' }),
      ]);
    }
    await request(app.getHttpServer())
      .put(path)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ serviceIds: [serviceA, serviceA] })
      .expect(400);
    await request(app.getHttpServer())
      .put(path)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ serviceIds: [serviceB] })
      .expect(404);
    await request(app.getHttpServer())
      .put(path)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ serviceIds: [] })
      .expect(200)
      .expect([]);
  });

  it('replaces and serializes schedules, allowing adjacency and rejecting invalid sets atomically', async () => {
    const a = await login('demo-business-a');
    const path = `/api/employees/${employeeA}/schedules`;
    const valid = {
      schedules: [
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
        {
          dayOfWeek: 'MONDAY',
          startTime: '12:00:00',
          endTime: '17:00:00',
          active: false,
        },
        { dayOfWeek: 'TUESDAY', startTime: '08:30', endTime: '10:00' },
      ],
    };
    const saved = await request(app.getHttpServer())
      .put(path)
      .set('Origin', origin)
      .set('Cookie', a)
      .send(valid)
      .expect(200);
    expect(saved.body).toEqual([
      {
        dayOfWeek: 'MONDAY',
        startTime: '09:00:00',
        endTime: '12:00:00',
        active: true,
      },
      {
        dayOfWeek: 'MONDAY',
        startTime: '12:00:00',
        endTime: '17:00:00',
        active: false,
      },
      {
        dayOfWeek: 'TUESDAY',
        startTime: '08:30:00',
        endTime: '10:00:00',
        active: true,
      },
    ]);
    for (const schedules of [
      [{ dayOfWeek: 'MONDAY', startTime: '12:00', endTime: '09:00' }],
      [
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
      ],
      [
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 'MONDAY', startTime: '11:59', endTime: '13:00' },
      ],
      [{ dayOfWeek: 'FUNDAY', startTime: '09:00', endTime: '10:00' }],
      [{ dayOfWeek: 'MONDAY', startTime: '25:00', endTime: '26:00' }],
    ])
      await request(app.getHttpServer())
        .put(path)
        .set('Origin', origin)
        .set('Cookie', a)
        .send({ schedules })
        .expect(400);
    const unchanged = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', a)
      .expect(200);
    expect(unchanged.body).toEqual(saved.body);
    await request(app.getHttpServer())
      .put(path)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ schedules: [] })
      .expect(200)
      .expect([]);
  });

  it('enforces view/manage permissions on direct calls', async () => {
    const viewer = await login('demo-business-a', viewerUsername),
      none = await login('demo-business-a', noneUsername);
    await request(app.getHttpServer())
      .get('/api/employees')
      .set('Cookie', viewer)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/services')
      .set('Cookie', viewer)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Origin', origin)
      .set('Cookie', viewer)
      .send({ displayName: 'Denied', branchId: branchA })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/employees/${employeeA}/schedules`)
      .set('Origin', origin)
      .set('Cookie', viewer)
      .send({ schedules: [] })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/services')
      .set('Origin', origin)
      .set('Cookie', viewer)
      .send({ name: 'Denied', durationMinutes: 10, price: '1' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/employees')
      .set('Cookie', none)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/services')
      .set('Cookie', none)
      .expect(403);
  });
});
