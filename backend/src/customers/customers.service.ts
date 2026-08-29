import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerSelect = {
  id: true,
  businessId: true,
  branchId: true,
  name: true,
  phone: true,
  active: true,
  email: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, query: ListCustomersQueryDto) {
    const search = query.search?.trim();
    const where = {
      businessId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: customerSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async create(businessId: string, input: CreateCustomerDto) {
    const data = this.normalizeCreate(input);
    await this.assertPhoneAvailable(businessId, data.phone);

    try {
      return await this.prisma.customer.create({
        data: { businessId, ...data },
        select: customerSelect,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
      select: customerSelect,
    });
    if (!customer) {
      throw new NotFoundException();
    }
    return customer;
  }

  async update(businessId: string, id: string, input: UpdateCustomerDto) {
    const data = this.normalizeUpdate(input);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field is required');
    }
    await this.findOne(businessId, id);
    if (data.phone) {
      await this.assertPhoneAvailable(businessId, data.phone, id);
    }

    try {
      return await this.prisma.customer.update({
        where: { id, businessId },
        data,
        select: customerSelect,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  private normalizeCreate(input: CreateCustomerDto) {
    return {
      name: this.normalizeName(input.name),
      phone: this.normalizePhone(input.phone),
      email: this.normalizeOptional(input.email, true),
      notes: this.normalizeOptional(input.notes),
      active: input.active,
    };
  }

  private normalizeUpdate(input: UpdateCustomerDto) {
    return {
      ...(input.name !== undefined
        ? { name: this.normalizeName(input.name) }
        : {}),
      ...(input.phone !== undefined
        ? { phone: this.normalizePhone(input.phone) }
        : {}),
      ...(input.email !== undefined
        ? { email: this.normalizeOptional(input.email, true) }
        : {}),
      ...(input.notes !== undefined
        ? { notes: this.normalizeOptional(input.notes) }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
  }

  private normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new BadRequestException('Invalid name');
    }
    return normalized;
  }

  private normalizePhone(value: string): string {
    const normalized = value.trim().replace(/[\s().-]/g, '');
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      throw new BadRequestException('Invalid phone');
    }
    return normalized;
  }

  private normalizeOptional(value: string | undefined, lowercase = false) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }
    return lowercase ? normalized.toLowerCase() : normalized;
  }

  private async assertPhoneAvailable(
    businessId: string,
    phone: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.customer.findFirst({
      where: {
        businessId,
        phone,
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Customer phone already exists');
    }
  }

  private rethrowDuplicate(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Customer phone already exists');
    }
    throw error;
  }
}
