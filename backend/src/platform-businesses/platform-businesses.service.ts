import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IANAZone } from 'luxon';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformBusinessDto } from './dto/create-platform-business.dto';
import { ListPlatformBusinessesQueryDto } from './dto/list-platform-businesses-query.dto';
import { UpdatePlatformBusinessDto } from './dto/update-platform-business.dto';

const businessListSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  maxUsers: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

const businessDetailSelect = {
  ...businessListSelect,
  taxId: true,
  address: true,
  phone: true,
  settingsJson: true,
  branches: {
    select: {
      id: true,
      businessId: true,
      name: true,
      isMain: true,
      active: true,
      address: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { isMain: 'desc' as const },
  },
  _count: {
    select: {
      branches: true,
      users: true,
      customers: true,
      employees: true,
      services: true,
      appointments: true,
      sales: true,
    },
  },
} as const;

@Injectable()
export class PlatformBusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListPlatformBusinessesQueryDto) {
    const search = query.search?.trim();
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        select: businessListSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.business.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      select: businessDetailSelect,
    });
    if (!business) throw new NotFoundException();
    return this.toDetail(business);
  }

  async create(platformUserId: string, input: CreatePlatformBusinessDto) {
    const slug = this.normalizeSlug(input.slug);
    this.assertTimezone(input.timezone.trim());
    const passwordHash = await this.passwords.hash(input.admin.password);

    try {
      const id = await this.prisma.$transaction(async (transaction) => {
        const business = await transaction.business.create({
          data: {
            name: this.requiredText(input.name, 'name'),
            slug,
            status: 'ACTIVE',
            timezone: input.timezone.trim(),
            currency: input.currency.toUpperCase(),
            maxUsers: input.maxUsers,
            logoUrl: this.optionalText(input.logoUrl),
            taxId: this.optionalText(input.taxId),
            address: this.optionalText(input.address),
            phone: this.optionalText(input.phone),
          },
          select: { id: true },
        });
        await transaction.branch.create({
          data: {
            businessId: business.id,
            name: this.requiredText(input.branch.name, 'branch.name'),
            isMain: true,
            active: true,
            address: this.optionalText(input.branch.address),
            phone: this.optionalText(input.branch.phone),
          },
        });
        const role = await transaction.role.create({
          data: {
            businessId: business.id,
            name: 'ADMIN',
            description: 'Business administrator role',
            active: true,
            isSystemDefault: true,
          },
          select: { id: true },
        });
        const permissions = await transaction.permission.findMany({
          select: { id: true },
        });
        if (!permissions.length) {
          throw new BadRequestException('Permission catalog is empty');
        }
        await transaction.rolePermission.createMany({
          data: permissions.map(({ id: permissionId }) => ({
            roleId: role.id,
            permissionId,
          })),
        });
        await transaction.user.create({
          data: {
            businessId: business.id,
            roleId: role.id,
            username: this.requiredText(input.admin.username, 'admin.username'),
            passwordHash,
            status: 'ACTIVE',
            mustChangePassword: true,
            isOwner: true,
            email: this.optionalText(input.admin.email)?.toLowerCase() ?? null,
            phone: this.optionalText(input.admin.phone),
            displayName: this.optionalText(input.admin.displayName),
          },
        });
        await transaction.auditLog.create({
          data: {
            businessId: business.id,
            platformUserId,
            action: 'BUSINESS_CREATED',
            entityType: 'Business',
            entityId: business.id,
            newValueJson: {
              name: this.requiredText(input.name, 'name'),
              slug,
              status: 'ACTIVE',
              timezone: input.timezone.trim(),
              currency: input.currency.toUpperCase(),
              maxUsers: input.maxUsers,
            },
          },
        });
        return business.id;
      });
      return this.findOne(id);
    } catch (error) {
      this.rethrowCreateError(error);
    }
  }

  async update(
    platformUserId: string,
    id: string,
    input: UpdatePlatformBusinessDto,
  ) {
    const data = {
      ...(input.name !== undefined
        ? { name: this.requiredText(input.name, 'name') }
        : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone.trim() }
        : {}),
      ...(input.currency !== undefined
        ? { currency: input.currency.toUpperCase() }
        : {}),
      ...(input.maxUsers !== undefined ? { maxUsers: input.maxUsers } : {}),
      ...(input.logoUrl !== undefined
        ? { logoUrl: this.optionalText(input.logoUrl) }
        : {}),
      ...(input.taxId !== undefined
        ? { taxId: this.optionalText(input.taxId) }
        : {}),
      ...(input.address !== undefined
        ? { address: this.optionalText(input.address) }
        : {}),
      ...(input.phone !== undefined
        ? { phone: this.optionalText(input.phone) }
        : {}),
    };
    if (!Object.keys(data).length) {
      throw new BadRequestException('At least one field is required');
    }
    if ('timezone' in data) this.assertTimezone(data.timezone as string);

    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.business.findUnique({
        where: { id },
        select: businessListSelect,
      });
      if (!current) throw new NotFoundException();
      const updated = await transaction.business.update({
        where: { id },
        data,
        select: businessListSelect,
      });
      await transaction.auditLog.create({
        data: {
          businessId: id,
          platformUserId,
          action: 'BUSINESS_UPDATED',
          entityType: 'Business',
          entityId: id,
          oldValueJson: current,
          newValueJson: updated,
        },
      });
    });
    return this.findOne(id);
  }

  async changeStatus(
    platformUserId: string,
    id: string,
    target: 'ACTIVE' | 'SUSPENDED',
  ) {
    const source = target === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.business.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new NotFoundException();
      if (current.status !== source) {
        throw new ConflictException(
          `Business must be ${source} to become ${target}`,
        );
      }
      await transaction.business.update({
        where: { id },
        data: { status: target },
      });
      await transaction.auditLog.create({
        data: {
          businessId: id,
          platformUserId,
          action:
            target === 'SUSPENDED'
              ? 'BUSINESS_SUSPENDED'
              : 'BUSINESS_REACTIVATED',
          entityType: 'Business',
          entityId: id,
          oldValueJson: { status: source },
          newValueJson: { status: target },
        },
      });
    });
    return this.findOne(id);
  }

  private toDetail<T extends { _count: Record<string, number> }>(business: T) {
    const { _count, ...detail } = business;
    return { ...detail, summary: _count };
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (
      !slug ||
      slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      throw new BadRequestException('Invalid slug');
    }
    return slug;
  }

  private assertTimezone(value: string): void {
    if (!IANAZone.isValidZone(value)) {
      throw new BadRequestException('Invalid timezone');
    }
  }

  private requiredText(value: string, field: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) throw new BadRequestException(`Invalid ${field}`);
    return normalized;
  }

  private optionalText(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  private rethrowCreateError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Business slug already exists');
    }
    throw error;
  }
}
