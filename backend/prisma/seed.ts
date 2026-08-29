import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const permissionCodes = [
  'dashboard.view',
  'customers.view',
  'customers.manage',
  'employees.view',
  'employees.manage',
  'services.view',
  'services.manage',
  'appointments.view',
  'appointments.manage',
  'sales.view',
  'sales.manage',
  'users.view',
  'users.manage',
  'roles.view',
  'roles.manage',
  'settings.view',
  'settings.manage',
] as const;

const employeePermissionCodes = [
  'dashboard.view',
  'appointments.view',
  'appointments.manage',
  'customers.view',
  'services.view',
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('The development seed only runs with NODE_ENV=development');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const seedPassword = process.env.DEV_SEED_PASSWORD;
  if (!databaseUrl || !seedPassword) {
    throw new Error('DATABASE_URL and DEV_SEED_PASSWORD are required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await argon2.hash(seedPassword, {
      type: argon2.argon2id,
    });

    for (const code of permissionCodes) {
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: code,
          module: code.split('.')[0],
        },
      });
    }

    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...permissionCodes] } },
    });

    for (const businessInput of [
      { slug: 'demo-business-a', name: 'Demo Business A' },
      { slug: 'demo-business-b', name: 'Demo Business B' },
    ]) {
      const business = await prisma.business.upsert({
        where: { slug: businessInput.slug },
        update: {},
        create: {
          ...businessInput,
          status: 'ACTIVE',
          timezone: 'Europe/Malta',
          currency: 'EUR',
          maxUsers: 10,
        },
      });

      const adminRole = await prisma.role.upsert({
        where: {
          businessId_name: { businessId: business.id, name: 'ADMIN' },
        },
        update: {},
        create: {
          businessId: business.id,
          name: 'ADMIN',
          description: 'Development administrator role',
          isSystemDefault: true,
        },
      });
      const employeeRole = await prisma.role.upsert({
        where: {
          businessId_name: { businessId: business.id, name: 'EMPLOYEE' },
        },
        update: {},
        create: {
          businessId: business.id,
          name: 'EMPLOYEE',
          description: 'Development employee role',
          isSystemDefault: true,
        },
      });

      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
      await prisma.rolePermission.createMany({
        data: permissions
          .filter((permission) =>
            employeePermissionCodes.includes(
              permission.code as (typeof employeePermissionCodes)[number],
            ),
          )
          .map((permission) => ({
            roleId: employeeRole.id,
            permissionId: permission.id,
          })),
        skipDuplicates: true,
      });

      await prisma.user.upsert({
        where: {
          businessId_username: {
            businessId: business.id,
            username: 'admin',
          },
        },
        update: {},
        create: {
          businessId: business.id,
          roleId: adminRole.id,
          username: 'admin',
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
          isOwner: true,
          displayName: `Admin ${businessInput.name}`,
          email: `admin@${businessInput.slug}.example.invalid`,
        },
      });
    }

    await prisma.platformUser.upsert({
      where: { username: 'platform_admin' },
      update: {},
      create: {
        username: 'platform_admin',
        email: 'platform-admin@deenova.example.invalid',
        passwordHash,
        status: 'ACTIVE',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Development seed failed');
  process.exitCode = 1;
});
