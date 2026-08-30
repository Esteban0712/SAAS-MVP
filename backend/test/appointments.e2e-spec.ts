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

describe('Appointments and availability (e2e)', () => {
  let app: INestApplication<App>, prisma: PrismaService;
  const password = process.env.DEV_SEED_PASSWORD,
    origin = 'http://localhost:5173',
    suffix = `${process.pid}-${Date.now()}`;
  let businessA: string,
    businessB: string,
    branchA: string,
    branchB: string,
    customerA: string,
    employeeA: string,
    employeeB: string,
    serviceA: string,
    serviceB: string,
    viewerUsername: string;
  const appointmentIds: string[] = [],
    userIds: string[] = [],
    roleIds: string[] = [];
  let originalPasswords: Array<{ id: string; passwordHash: string }> = [];

  beforeAll(async () => {
    if (!password)
      throw new Error('DEV_SEED_PASSWORD is required for appointments e2e');
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
    const hash = await argon2.hash(password);
    await prisma.user.updateMany({
      where: { id: { in: originalPasswords.map((u) => u.id) } },
      data: { passwordHash: hash },
    });
    const [ba, bb] = await Promise.all([
      prisma.branch.create({
        data: {
          businessId: businessA,
          name: `Agenda A ${suffix}`,
          isMain: true,
        },
      }),
      prisma.branch.create({
        data: {
          businessId: businessB,
          name: `Agenda B ${suffix}`,
          isMain: true,
        },
      }),
    ]);
    branchA = ba.id;
    branchB = bb.id;
    const customer = await prisma.customer.create({
      data: {
        businessId: businessA,
        name: `Customer ${suffix}`,
        phone: `+35677${Date.now().toString().slice(-6)}`,
      },
    });
    customerA = customer.id;
    const [ea, eb] = await Promise.all([
      prisma.employee.create({
        data: {
          businessId: businessA,
          branchId: branchA,
          displayName: `Employee A ${suffix}`,
        },
      }),
      prisma.employee.create({
        data: {
          businessId: businessB,
          branchId: branchB,
          displayName: `Employee B ${suffix}`,
        },
      }),
    ]);
    employeeA = ea.id;
    employeeB = eb.id;
    const [sa, sb] = await Promise.all([
      prisma.service.create({
        data: {
          businessId: businessA,
          name: `Service A ${suffix}`,
          durationMinutes: 30,
          price: '25.50',
        },
      }),
      prisma.service.create({
        data: {
          businessId: businessB,
          name: `Service B ${suffix}`,
          durationMinutes: 30,
          price: '10.00',
        },
      }),
    ]);
    serviceA = sa.id;
    serviceB = sb.id;
    await prisma.employeeService.create({
      data: { employeeId: employeeA, serviceId: serviceA },
    });
    await prisma.employeeSchedule.create({
      data: {
        employeeId: employeeA,
        dayOfWeek: 'MONDAY',
        startTime: new Date('1970-01-01T09:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
      },
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: 'appointments.view' },
      select: { id: true },
    });
    const role = await prisma.role.create({
      data: {
        businessId: businessA,
        name: `APPT_VIEW_${suffix}`,
        permissions: { create: { permissionId: permission.id } },
      },
    });
    roleIds.push(role.id);
    viewerUsername = `appt-view-${suffix}`;
    const viewer = await prisma.user.create({
      data: {
        businessId: businessA,
        roleId: role.id,
        username: viewerUsername,
        passwordHash: hash,
        status: 'ACTIVE',
      },
    });
    userIds.push(viewer.id);
  });

  afterAll(async () => {
    if (app) {
      await prisma.appointmentService.deleteMany({
        where: { appointment: { customerId: customerA } },
      });
      await prisma.appointment.deleteMany({
        where: { customerId: customerA },
      });
      await prisma.employeeSchedule.deleteMany({
        where: { employeeId: employeeA },
      });
      await prisma.employeeService.deleteMany({
        where: { employeeId: employeeA },
      });
      await prisma.service.deleteMany({
        where: { id: { in: [serviceA, serviceB] } },
      });
      await prisma.employee.deleteMany({
        where: { id: { in: [employeeA, employeeB] } },
      });
      await prisma.customer.delete({ where: { id: customerA } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      await prisma.branch.deleteMany({
        where: { id: { in: [branchA, branchB] } },
      });
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
  const createBody = (startAt: string) => ({
    branchId: branchA,
    customerId: customerA,
    employeeId: employeeA,
    serviceIds: [serviceA],
    startAt,
    notes: ' Appointment note ',
  });

  it('returns availability with canonical UTC slots and DST-safe duration', async () => {
    const cookie = await login('demo-business-a');
    const response = await request(app.getHttpServer())
      .get(
        `/api/appointments/availability?branchId=${branchA}&employeeId=${employeeA}&serviceIds=${serviceA}&from=2026-09-07&to=2026-09-07`,
      )
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toMatchObject({
      timezone: 'Europe/Malta',
      durationMinutes: 30,
      from: '2026-09-07',
      to: '2026-09-07',
    });
    expect(response.body.days[0].slots[0]).toMatchObject({
      startAt: '2026-09-07T07:00:00.000Z',
      endAt: '2026-09-07T07:30:00.000Z',
      localStart: '2026-09-07T09:00:00',
    });
  });

  it('creates/lists/details with snapshots and blocks cross-tenant IDs and direct writes', async () => {
    const a = await login('demo-business-a'),
      b = await login('demo-business-b'),
      viewer = await login('demo-business-a', viewerUsername);
    const created = await request(app.getHttpServer())
      .post('/api/appointments?businessId=ignored')
      .set('Origin', origin)
      .set('x-business-id', businessB)
      .set('Cookie', a)
      .send(createBody('2026-09-07T07:00:00.000Z'))
      .expect(201);
    appointmentIds.push(String(created.body.id));
    expect(created.body).toMatchObject({
      businessId: businessA,
      source: 'ADMIN',
      status: 'PENDING',
      totalDurationMinutes: 30,
      totalPrice: '25.50',
      notes: 'Appointment note',
    });
    expect(created.body.services[0]).toMatchObject({
      serviceNameSnapshot: `Service A ${suffix}`,
      priceSnapshot: '25.50',
      durationMinutesSnapshot: 30,
    });
    await request(app.getHttpServer())
      .get(`/api/appointments/${created.body.id}`)
      .set('Cookie', b)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', a)
      .send({
        ...createBody('2026-09-07T08:00:00.000Z'),
        employeeId: employeeB,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', viewer)
      .send(createBody('2026-09-07T08:00:00.000Z'))
      .expect(403);
    const list = await request(app.getHttpServer())
      .get(
        '/api/appointments?from=2026-09-07T00:00:00Z&to=2026-09-08T00:00:00Z',
      )
      .set('Cookie', a)
      .expect(200);
    const items = list.body.items as Array<{ id: string }>;
    expect(list.body).toMatchObject({
      page: 1,
      pageSize: 20,
      timezone: 'Europe/Malta',
    });
    expect(typeof list.body.total).toBe('number');
    expect(typeof list.body.totalPages).toBe('number');
    expect(
      items.some((item: { id: string }) => item.id === created.body.id),
    ).toBe(true);
  });

  it('lets the exclusion constraint choose exactly one concurrent reservation and permits adjacency', async () => {
    const cookie = await login('demo-business-a');
    const calls = [1, 2].map(() =>
      request(app.getHttpServer())
        .post('/api/appointments')
        .set('Origin', origin)
        .set('Cookie', cookie)
        .send(createBody('2026-09-07T08:00:00.000Z')),
    );
    const results = await Promise.all(calls);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = results.find((r) => r.status === 201)!;
    appointmentIds.push(String(winner.body.id));
    const adjacent = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(createBody('2026-09-07T08:30:00.000Z'))
      .expect(201);
    appointmentIds.push(String(adjacent.body.id));
  });

  it('allows only one concurrent reschedule successor', async () => {
    const cookie = await login('demo-business-a');
    const original = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(createBody('2026-09-07T09:00:00.000Z'))
      .expect(201);
    appointmentIds.push(String(original.body.id));
    const results = await Promise.all(
      ['2026-09-07T10:00:00.000Z', '2026-09-07T11:00:00.000Z'].map((startAt) =>
        request(app.getHttpServer())
          .patch(`/api/appointments/${original.body.id}`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ action: 'RESCHEDULE', startAt }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const successor = results.find((r) => r.status === 200);
    if (successor) appointmentIds.push(String(successor.body.id));
    expect(successor).toBeDefined();
    if (!successor) throw new Error('Expected one successful reschedule');
    expect(successor.body.originalAppointmentId).toBe(original.body.id);
    const count = await prisma.appointment.count({
      where: { originalAppointmentId: original.body.id },
    });
    expect(count).toBe(1);
  });

  it('edits snapshots atomically and enforces status transitions', async () => {
    const cookie = await login('demo-business-a');
    const created = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send(createBody('2026-09-07T12:00:00.000Z'))
      .expect(201);
    appointmentIds.push(String(created.body.id));
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ action: 'EDIT', notes: ' Updated ' })
      .expect(200)
      .expect(({ body }) => expect(body.notes).toBe('Updated'));
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ action: 'STATUS', status: 'COMPLETED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ action: 'STATUS', status: 'CONFIRMED' })
      .expect(200);
  });

  it('rejects invalid services without partial appointment state', async () => {
    const cookie = await login('demo-business-a');
    const before = await prisma.appointment.count({
      where: { businessId: businessA },
    });
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        ...createBody('2026-09-07T13:00:00.000Z'),
        serviceIds: [serviceB],
      })
      .expect(404);
    expect(
      await prisma.appointment.count({ where: { businessId: businessA } }),
    ).toBe(before);
  });
});
