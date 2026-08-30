import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeScheduleInputDto } from './dto/replace-employee-schedules.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const employeeSelect = {
  id: true,
  businessId: true,
  branchId: true,
  userId: true,
  displayName: true,
  active: true,
  phone: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, isMain: true, active: true } },
} as const;
const serviceSelect = {
  id: true,
  name: true,
  durationMinutes: true,
  price: true,
  active: true,
  description: true,
  category: true,
} as const;
const days: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, query: ListEmployeesQueryDto) {
    const search = query.search?.trim();
    const where = {
      businessId,
      ...(search
        ? {
            OR: [
              {
                displayName: { contains: search, mode: 'insensitive' as const },
              },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: employeeSelect,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  listBranches(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId },
      select: { id: true, name: true, isMain: true, active: true },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(businessId: string, input: CreateEmployeeDto) {
    await this.assertBranch(businessId, input.branchId);
    return this.prisma.employee.create({
      data: {
        businessId,
        branchId: input.branchId,
        displayName: this.name(input.displayName),
        phone: this.optional(input.phone),
        notes: this.optional(input.notes),
        active: input.active,
      },
      select: employeeSelect,
    });
  }

  async findOne(businessId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, businessId },
      select: employeeSelect,
    });
    if (!employee) throw new NotFoundException();
    return employee;
  }

  async update(businessId: string, id: string, input: UpdateEmployeeDto) {
    const data = {
      ...(input.displayName !== undefined
        ? { displayName: this.name(input.displayName) }
        : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.phone !== undefined
        ? { phone: this.optional(input.phone) }
        : {}),
      ...(input.notes !== undefined
        ? { notes: this.optional(input.notes) }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    if (!Object.keys(data).length)
      throw new BadRequestException('At least one field is required');
    await this.findOne(businessId, id);
    if (input.branchId) await this.assertBranch(businessId, input.branchId);
    return this.prisma.employee.update({
      where: { id, businessId },
      data,
      select: employeeSelect,
    });
  }

  async getServices(businessId: string, employeeId: string) {
    await this.findOne(businessId, employeeId);
    const rows = await this.prisma.employeeService.findMany({
      where: { employeeId, service: { businessId } },
      select: { service: { select: serviceSelect } },
      orderBy: [{ service: { name: 'asc' } }, { serviceId: 'asc' }],
    });
    return rows.map(({ service }) => this.serializeService(service));
  }

  async replaceServices(
    businessId: string,
    employeeId: string,
    serviceIds: string[],
  ) {
    await this.findOne(businessId, employeeId);
    const count = await this.prisma.service.count({
      where: { id: { in: serviceIds }, businessId },
    });
    if (count !== serviceIds.length) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeService.deleteMany({ where: { employeeId } });
      if (serviceIds.length)
        await tx.employeeService.createMany({
          data: serviceIds.map((serviceId) => ({ employeeId, serviceId })),
        });
    });
    return this.getServices(businessId, employeeId);
  }

  async getSchedules(businessId: string, employeeId: string) {
    await this.findOne(businessId, employeeId);
    const rows = await this.prisma.employeeSchedule.findMany({
      where: { employeeId },
      select: { dayOfWeek: true, startTime: true, endTime: true, active: true },
    });
    return rows
      .map((row) => ({
        ...row,
        startTime: this.timeString(row.startTime),
        endTime: this.timeString(row.endTime),
      }))
      .sort((a, b) => this.scheduleSort(a, b));
  }

  async replaceSchedules(
    businessId: string,
    employeeId: string,
    input: EmployeeScheduleInputDto[],
  ) {
    await this.findOne(businessId, employeeId);
    const schedules = input.map((item) => ({
      dayOfWeek: item.dayOfWeek,
      startTime: this.canonicalTime(item.startTime),
      endTime: this.canonicalTime(item.endTime),
      active: item.active ?? true,
    }));
    this.validateSchedules(schedules);
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeSchedule.deleteMany({ where: { employeeId } });
      if (schedules.length)
        await tx.employeeSchedule.createMany({
          data: schedules.map((item) => ({
            employeeId,
            dayOfWeek: item.dayOfWeek,
            startTime: this.timeDate(item.startTime),
            endTime: this.timeDate(item.endTime),
            active: item.active,
          })),
        });
    });
    return this.getSchedules(businessId, employeeId);
  }

  private async assertBranch(businessId: string, id: string) {
    if (
      !(await this.prisma.branch.findFirst({
        where: { id, businessId },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
  }
  private name(value: string) {
    const result = value.trim().replace(/\s+/g, ' ');
    if (!result) throw new BadRequestException('Invalid name');
    return result;
  }
  private optional(value?: string) {
    return value?.trim() || null;
  }
  private serializeService<
    T extends { price: { toFixed(digits: number): string } },
  >(service: T) {
    return { ...service, price: service.price.toFixed(2) };
  }
  private canonicalTime(value: string) {
    return value.length === 5 ? `${value}:00` : value;
  }
  private timeDate(value: string) {
    return new Date(`1970-01-01T${value}Z`);
  }
  private timeString(value: Date) {
    return value.toISOString().slice(11, 19);
  }
  private scheduleSort(
    a: { dayOfWeek: DayOfWeek; startTime: string; endTime: string },
    b: { dayOfWeek: DayOfWeek; startTime: string; endTime: string },
  ) {
    return (
      days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime)
    );
  }
  private validateSchedules(
    schedules: Array<{
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
    }>,
  ) {
    const byDay = new Map<
      DayOfWeek,
      Array<{ startTime: string; endTime: string }>
    >();
    for (const schedule of schedules) {
      if (schedule.startTime >= schedule.endTime)
        throw new BadRequestException('Schedule start must be before end');
      const current = byDay.get(schedule.dayOfWeek) ?? [];
      if (
        current.some(
          (other) =>
            schedule.startTime < other.endTime &&
            schedule.endTime > other.startTime,
        )
      )
        throw new BadRequestException('Schedule blocks overlap');
      current.push(schedule);
      byDay.set(schedule.dayOfWeek, current);
    }
  }
}
