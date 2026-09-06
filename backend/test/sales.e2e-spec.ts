/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(90_000);
describe('Sales, payments and receipts (e2e)', () => {
  let app: INestApplication<App>, prisma: PrismaService;
  const password = process.env.DEV_SEED_PASSWORD,
    origin = 'http://localhost:5173',
    suffix = `${process.pid}-${Date.now()}`;
  let businessA: string,
    businessB: string,
    branchA: string,
    customerA: string,
    employeeA: string,
    serviceA: string,
    appointmentA: string,
    viewerUsername: string;
  const saleIds: string[] = [],
    userIds: string[] = [],
    roleIds: string[] = [];
  let originalPasswords: Array<{ id: string; passwordHash: string }> = [];

  beforeAll(async () => {
    if (!password)
      throw new Error('DEV_SEED_PASSWORD is required for sales e2e');
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
    businessA = businesses.find((item) => item.slug === 'demo-business-a')!.id;
    businessB = businesses.find((item) => item.slug === 'demo-business-b')!.id;
    originalPasswords = await prisma.user.findMany({
      where: { businessId: { in: [businessA, businessB] }, username: 'admin' },
      select: { id: true, passwordHash: true },
    });
    const hash = await argon2.hash(password);
    await prisma.user.updateMany({
      where: { id: { in: originalPasswords.map((item) => item.id) } },
      data: { passwordHash: hash },
    });
    const branch = await prisma.branch.create({
      data: { businessId: businessA, name: `Sales ${suffix}`, isMain: true },
    });
    branchA = branch.id;
    const customer = await prisma.customer.create({
      data: {
        businessId: businessA,
        name: `Buyer ${suffix}`,
        phone: `+35688${Date.now().toString().slice(-6)}`,
      },
    });
    customerA = customer.id;
    const employee = await prisma.employee.create({
      data: {
        businessId: businessA,
        branchId: branchA,
        displayName: `Seller ${suffix}`,
      },
    });
    employeeA = employee.id;
    const service = await prisma.service.create({
      data: {
        businessId: businessA,
        name: `Service ${suffix}`,
        durationMinutes: 30,
        price: '25.50',
      },
    });
    serviceA = service.id;
    const appointment = await prisma.appointment.create({
      data: {
        businessId: businessA,
        branchId: branchA,
        customerId: customerA,
        employeeId: employeeA,
        status: 'COMPLETED',
        source: 'ADMIN',
        startAt: new Date('2027-01-10T09:00:00Z'),
        endAt: new Date('2027-01-10T09:30:00Z'),
        services: {
          create: {
            serviceId: serviceA,
            serviceNameSnapshot: service.name,
            priceSnapshot: '25.50',
            durationMinutesSnapshot: 30,
          },
        },
      },
    });
    appointmentA = appointment.id;
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { code: 'sales.view' },
    });
    const role = await prisma.role.create({
      data: {
        businessId: businessA,
        name: `SALE_VIEW_${suffix}`,
        permissions: { create: { permissionId: permission.id } },
      },
    });
    roleIds.push(role.id);
    viewerUsername = `sale-view-${suffix}`;
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
    if (!app) return;
    await prisma.receipt.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.payment.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: appointmentA },
    });
    await prisma.appointment.delete({ where: { id: appointmentA } });
    await prisma.service.delete({ where: { id: serviceA } });
    await prisma.employee.delete({ where: { id: employeeA } });
    await prisma.customer.delete({ where: { id: customerA } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await prisma.branch.delete({ where: { id: branchA } });
    for (const user of originalPasswords)
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: user.passwordHash },
      });
    await app.close();
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

  it('calculates manual totals and enforces tenant/permission isolation', async () => {
    const a = await login('demo-business-a'),
      b = await login('demo-business-b'),
      viewer = await login('demo-business-a', viewerUsername);
    const created = await request(app.getHttpServer())
      .post('/api/sales?businessId=ignored')
      .set('Origin', origin)
      .set('x-business-id', businessB)
      .set('Cookie', a)
      .send({
        branchId: branchA,
        customerId: customerA,
        employeeId: employeeA,
        items: [
          {
            serviceId: serviceA,
            type: 'SERVICE',
            description: ' Service ',
            quantity: 2,
            unitPrice: '25.50',
          },
        ],
        discountTotal: '1.00',
        taxTotal: '2.00',
      })
      .expect(201);
    saleIds.push(String(created.body.id));
    expect(created.body).toMatchObject({
      businessId: businessA,
      subtotal: '51.00',
      discountTotal: '1.00',
      taxTotal: '2.00',
      total: '52.00',
      amountPaid: '0.00',
      balanceDue: '52.00',
      status: 'DRAFT',
    });
    await request(app.getHttpServer())
      .get(`/api/sales/${created.body.id}`)
      .set('Cookie', b)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Origin', origin)
      .set('Cookie', viewer)
      .send({
        branchId: branchA,
        items: [
          { type: 'OTHER', description: 'x', quantity: 1, unitPrice: '1.00' },
        ],
      })
      .expect(403);
    const list = await request(app.getHttpServer())
      .get('/api/sales?page=1&pageSize=20&search=Buyer')
      .set('Cookie', a)
      .expect(200);
    const items = list.body.items as Array<{ id: string }>;
    expect(
      items.some((item: { id: string }) => item.id === created.body.id),
    ).toBe(true);
  });

  it('creates once from appointment, pays and generates one receipt snapshot', async () => {
    const cookie = await login('demo-business-a');
    const created = await request(app.getHttpServer())
      .post('/api/sales')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ appointmentId: appointmentA })
      .expect(201);
    saleIds.push(String(created.body.id));
    expect(created.body).toMatchObject({
      total: '25.50',
      appointmentId: appointmentA,
    });
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ appointmentId: appointmentA })
      .expect(409);
    const pending = await request(app.getHttpServer())
      .patch(`/api/sales/${created.body.id}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ status: 'PENDING_PAYMENT', notes: 'Ready' })
      .expect(200);
    expect(pending.body.status).toBe('PENDING_PAYMENT');
    await request(app.getHttpServer())
      .post(`/api/sales/${created.body.id}/payments`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ method: 'CARD', amount: '25.51', status: 'COMPLETED' })
      .expect(409);
    const paid = await request(app.getHttpServer())
      .post(`/api/sales/${created.body.id}/payments`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        method: 'CARD',
        amount: '25.50',
        status: 'COMPLETED',
        externalReference: 'manual-test',
      })
      .expect(201);
    expect(paid.body).toMatchObject({
      amountPaid: '25.50',
      balanceDue: '0.00',
      saleStatus: 'PAID',
    });
    const receipt = await request(app.getHttpServer())
      .post(`/api/sales/${created.body.id}/receipt`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(201);
    expect(receipt.body.receiptNumber).toMatch(/^\d{8}-[0-9A-F]{6}$/);
    expect(receipt.body.dataJson.total).toBe('25.50');
    const again = await request(app.getHttpServer())
      .post(`/api/sales/${created.body.id}/receipt`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(201);
    expect(again.body.id).toBe(receipt.body.id);
    await request(app.getHttpServer())
      .get(`/api/sales/${created.body.id}/payments`)
      .set('Cookie', cookie)
      .expect(200)
      .expect((response) => expect(response.body[0].amount).toBe('25.50'));
    await request(app.getHttpServer())
      .get(`/api/sales/${created.body.id}/receipt`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('serializes concurrent payments and permits only the amount outstanding', async () => {
    const cookie = await login('demo-business-a');
    const created = await request(app.getHttpServer())
      .post('/api/sales')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({
        branchId: branchA,
        items: [
          {
            type: 'OTHER',
            description: 'Concurrent',
            quantity: 1,
            unitPrice: '25.50',
          },
        ],
      })
      .expect(201);
    saleIds.push(String(created.body.id));
    await request(app.getHttpServer())
      .patch(`/api/sales/${created.body.id}`)
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ status: 'PENDING_PAYMENT' })
      .expect(200);

    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/api/sales/${created.body.id}/payments`)
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send({ method: 'CARD', amount: '20.00', status: 'COMPLETED' }),
      ),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);

    const payments = await request(app.getHttpServer())
      .get(`/api/sales/${created.body.id}/payments`)
      .set('Cookie', cookie)
      .expect(200);
    expect(payments.body).toHaveLength(1);
    expect(payments.body[0].amount).toBe('20.00');
  });
});
