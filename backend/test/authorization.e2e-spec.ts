import {
  Body,
  Controller,
  Get,
  INestApplication,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthModule } from '../src/auth/auth.module';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types';
import { CurrentPrincipal } from '../src/auth/current-principal.decorator';
import { Permissions } from '../src/auth/permissions.decorator';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PlatformGuard } from '../src/auth/platform.guard';
import { TenantGuard } from '../src/auth/tenant.guard';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
class TenantIdentityProbeService {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(principal: AuthenticatedPrincipal, userId: string) {
    if (principal.actorType !== 'USER') {
      throw new NotFoundException();
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId: principal.businessId },
      select: { id: true, businessId: true, username: true },
    });
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }
}

@Controller('test-authorization')
class TenantAuthorizationProbeController {
  constructor(private readonly identities: TenantIdentityProbeService) {}

  @Post('tenant')
  @UseGuards(AuthGuard, TenantGuard)
  tenant(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() _body: Record<string, unknown>,
    @Query('businessId') _queryBusinessId?: string,
  ) {
    void _body;
    void _queryBusinessId;
    return principal;
  }

  @Get('users/:id')
  @Permissions('users.view')
  @UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
  user(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.identities.findUser(principal, id);
  }

  @Get('forbidden')
  @Permissions('permission.not.granted')
  @UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
  forbidden(): void {}
}

@Controller('test-authorization/platform')
class PlatformAuthorizationProbeController {
  @Get()
  @UseGuards(AuthGuard, PlatformGuard)
  platform(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return principal;
  }
}

@Module({
  imports: [AuthModule],
  controllers: [
    TenantAuthorizationProbeController,
    PlatformAuthorizationProbeController,
  ],
  providers: [TenantIdentityProbeService],
})
class AuthorizationProbeModule {}

describe('Authorization and tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let originalTenantPasswords: Array<{ id: string; passwordHash: string }> = [];
  let originalPlatformPassword:
    { id: string; passwordHash: string } | undefined;
  const origin = 'http://localhost:5173';
  const password = process.env.DEV_SEED_PASSWORD;

  beforeAll(async () => {
    if (!password) {
      throw new Error('DEV_SEED_PASSWORD is required for authorization e2e');
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthorizationProbeModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    originalTenantPasswords = await prisma.user.findMany({
      where: {
        username: 'admin',
        business: {
          slug: { in: ['demo-business-a', 'demo-business-b'] },
        },
      },
      select: { id: true, passwordHash: true },
    });
    originalPlatformPassword =
      (await prisma.platformUser.findUnique({
        where: { username: 'platform_admin' },
        select: { id: true, passwordHash: true },
      })) ?? undefined;

    if (originalTenantPasswords.length !== 2 || !originalPlatformPassword) {
      throw new Error('Authorization e2e seed actors are required');
    }

    const passwordHash = await argon2.hash(password);
    await prisma.user.updateMany({
      where: { id: { in: originalTenantPasswords.map(({ id }) => id) } },
      data: { passwordHash },
    });
    await prisma.platformUser.update({
      where: { id: originalPlatformPassword.id },
      data: { passwordHash },
    });
  }, 30_000);

  afterAll(async () => {
    if (app) {
      for (const user of originalTenantPasswords) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: user.passwordHash },
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

  async function tenantLogin(businessSlug: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ businessSlug, username: 'admin', password })
      .expect(200);
    return {
      cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(
        ';',
      )[0],
      principal: response.body as AuthenticatedPrincipal,
    };
  }

  async function platformLogin() {
    const response = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .set('Origin', origin)
      .send({ username: 'platform_admin', password })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  }

  it('isolates Admin A and Admin B identities in both directions', async () => {
    const adminA = await tenantLogin('demo-business-a');
    const adminB = await tenantLogin('demo-business-b');
    if (
      adminA.principal.actorType !== 'USER' ||
      adminB.principal.actorType !== 'USER'
    ) {
      throw new Error('Expected tenant principals');
    }

    await request(app.getHttpServer())
      .get(`/api/test-authorization/users/${adminB.principal.userId}`)
      .set('Cookie', adminA.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/test-authorization/users/${adminA.principal.userId}`)
      .set('Cookie', adminB.cookie)
      .expect(404);
  });

  it('ignores manipulated tenant values from body, query and headers', async () => {
    const adminA = await tenantLogin('demo-business-a');
    const adminB = await tenantLogin('demo-business-b');
    if (
      adminA.principal.actorType !== 'USER' ||
      adminB.principal.actorType !== 'USER'
    ) {
      throw new Error('Expected tenant principals');
    }

    const response = await request(app.getHttpServer())
      .post(
        `/api/test-authorization/tenant?businessId=${adminB.principal.businessId}`,
      )
      .set('Origin', origin)
      .set('Cookie', adminA.cookie)
      .set('x-business-id', adminB.principal.businessId)
      .send({ businessId: adminB.principal.businessId })
      .expect(201);
    const body = response.body as { businessId: string };
    expect(body.businessId).toBe(adminA.principal.businessId);
  });

  it('separates tenant and platform areas', async () => {
    const adminA = await tenantLogin('demo-business-a');
    const platformCookie = await platformLogin();

    await request(app.getHttpServer())
      .get('/api/test-authorization/platform')
      .set('Cookie', adminA.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/test-authorization/tenant')
      .set('Origin', origin)
      .set('Cookie', platformCookie)
      .send({})
      .expect(403);
  });

  it('returns 403 when the current DB permissions do not satisfy the route', async () => {
    const adminA = await tenantLogin('demo-business-a');
    await request(app.getHttpServer())
      .get('/api/test-authorization/forbidden')
      .set('Cookie', adminA.cookie)
      .expect(403);
  });

  it('re-reads permissions from DB for an already issued session', async () => {
    const adminA = await tenantLogin('demo-business-a');
    if (adminA.principal.actorType !== 'USER') {
      throw new Error('Expected tenant principal');
    }

    const rolePermission = await prisma.rolePermission.findFirstOrThrow({
      where: {
        roleId: adminA.principal.roleId,
        permission: { code: 'users.view' },
      },
      select: { roleId: true, permissionId: true },
    });

    try {
      await prisma.rolePermission.delete({
        where: {
          roleId_permissionId: rolePermission,
        },
      });

      await request(app.getHttpServer())
        .get(`/api/test-authorization/users/${adminA.principal.userId}`)
        .set('Cookie', adminA.cookie)
        .expect(403);
    } finally {
      await prisma.rolePermission.create({ data: rolePermission });
    }
  });

  it('rejects an issued session when its user or business becomes inactive', async () => {
    const adminA = await tenantLogin('demo-business-a');
    if (adminA.principal.actorType !== 'USER') {
      throw new Error('Expected tenant principal');
    }

    try {
      await prisma.user.update({
        where: { id: adminA.principal.userId },
        data: { status: 'SUSPENDED' },
      });
      await request(app.getHttpServer())
        .post('/api/test-authorization/tenant')
        .set('Origin', origin)
        .set('Cookie', adminA.cookie)
        .send({})
        .expect(401);
    } finally {
      await prisma.user.update({
        where: { id: adminA.principal.userId },
        data: { status: 'ACTIVE' },
      });
    }

    try {
      await prisma.business.update({
        where: { id: adminA.principal.businessId },
        data: { status: 'SUSPENDED' },
      });
      await request(app.getHttpServer())
        .post('/api/test-authorization/tenant')
        .set('Origin', origin)
        .set('Cookie', adminA.cookie)
        .send({})
        .expect(401);
    } finally {
      await prisma.business.update({
        where: { id: adminA.principal.businessId },
        data: { status: 'ACTIVE' },
      });
    }
  });
});
