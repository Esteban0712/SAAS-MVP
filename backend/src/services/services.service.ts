import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const serviceSelect = {
  id: true,
  businessId: true,
  name: true,
  durationMinutes: true,
  price: true,
  active: true,
  description: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(businessId: string, query: ListServicesQueryDto) {
    const search = query.search?.trim();
    const where = {
      businessId,
      ...(search
        ? {
            OR: ['name', 'category', 'description'].map((field) => ({
              [field]: { contains: search, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        select: serviceSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.service.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.serialize(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }
  async create(businessId: string, input: CreateServiceDto) {
    const row = await this.prisma.service.create({
      data: {
        businessId,
        name: this.name(input.name),
        durationMinutes: input.durationMinutes,
        price: new Prisma.Decimal(input.price),
        description: this.optional(input.description),
        category: this.optional(input.category),
        active: input.active,
      },
      select: serviceSelect,
    });
    return this.serialize(row);
  }
  async findOne(businessId: string, id: string) {
    const row = await this.prisma.service.findFirst({
      where: { id, businessId },
      select: serviceSelect,
    });
    if (!row) throw new NotFoundException();
    return this.serialize(row);
  }
  async update(businessId: string, id: string, input: UpdateServiceDto) {
    const data = {
      ...(input.name !== undefined ? { name: this.name(input.name) } : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: input.durationMinutes }
        : {}),
      ...(input.price !== undefined
        ? { price: new Prisma.Decimal(input.price) }
        : {}),
      ...(input.description !== undefined
        ? { description: this.optional(input.description) }
        : {}),
      ...(input.category !== undefined
        ? { category: this.optional(input.category) }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    if (!Object.keys(data).length)
      throw new BadRequestException('At least one field is required');
    await this.findOne(businessId, id);
    const row = await this.prisma.service.update({
      where: { id, businessId },
      data,
      select: serviceSelect,
    });
    return this.serialize(row);
  }
  private name(value: string) {
    const result = value.trim().replace(/\s+/g, ' ');
    if (!result) throw new BadRequestException('Invalid name');
    return result;
  }
  private optional(value?: string) {
    return value?.trim() || null;
  }
  private serialize<T extends { price: { toFixed(digits: number): string } }>(
    row: T,
  ) {
    return { ...row, price: row.price.toFixed(2) };
  }
}
