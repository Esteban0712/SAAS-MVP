import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '../generated/prisma/client';
import { AppointmentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import {
  AppointmentAction,
  UpdateAppointmentDto,
} from './dto/update-appointment.dto';
import { TimezoneService } from './timezone.service';

const reprogrammable: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];
const detailInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  employee: { select: { id: true, displayName: true } },
  services: {
    select: {
      id: true,
      serviceId: true,
      serviceNameSnapshot: true,
      priceSnapshot: true,
      durationMinutesSnapshot: true,
    },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly timezone: TimezoneService,
  ) {}

  async list(businessId: string, query: ListAppointmentsQueryDto) {
    const from = new Date(query.from),
      to = new Date(query.to);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to < from ||
      to.getTime() - from.getTime() > 31 * 86_400_000
    )
      throw new BadRequestException('Invalid appointment range');
    const where = {
      businessId,
      startAt: { gte: from, lte: to },
      employeeId: query.employeeId,
      branchId: query.branchId,
      customerId: query.customerId,
      status: query.status,
    };
    const [rows, total, business] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: detailInclude,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { timezone: true },
      }),
    ]);
    if (!business) throw new NotFoundException();
    return {
      items: rows.map((row) => this.serialize(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      timezone: business.timezone,
    };
  }

  async findOne(businessId: string, id: string) {
    const row = await this.prisma.appointment.findFirst({
      where: { id, businessId },
      include: detailInclude,
    });
    if (!row) throw new NotFoundException();
    return this.serialize(row);
  }

  async create(
    businessId: string,
    userId: string,
    input: CreateAppointmentDto,
  ) {
    const start = this.timezone.utcDate(input.startAt);
    const slot = await this.requireSlot(
      businessId,
      input.branchId,
      input.employeeId,
      input.serviceIds,
      start,
    );
    return this.transaction(async (tx) => {
      await this.assertCustomer(tx, businessId, input.customerId);
      const snapshots = await this.snapshots(
        tx,
        businessId,
        input.employeeId,
        input.serviceIds,
      );
      const appointment = await tx.appointment.create({
        data: {
          businessId,
          branchId: input.branchId,
          customerId: input.customerId,
          employeeId: input.employeeId,
          createdByUserId: userId,
          source: 'ADMIN',
          startAt: start.toJSDate(),
          endAt: new Date(slot.endAt),
          notes: this.optional(input.notes),
          services: { create: snapshots },
        },
        include: detailInclude,
      });
      return this.serialize(appointment);
    });
  }

  async update(
    businessId: string,
    userId: string,
    id: string,
    input: UpdateAppointmentDto,
  ) {
    if (input.action === AppointmentAction.EDIT)
      return this.edit(businessId, id, input);
    if (input.action === AppointmentAction.RESCHEDULE)
      return this.reschedule(businessId, userId, id, input);
    if (input.action === AppointmentAction.STATUS)
      return this.changeStatus(businessId, id, input);
    throw new BadRequestException('Invalid action');
  }

  private async edit(
    businessId: string,
    id: string,
    input: UpdateAppointmentDto,
  ) {
    if (input.startAt || input.branchId || input.employeeId || input.status)
      throw new BadRequestException('Invalid EDIT fields');
    if (
      input.customerId === undefined &&
      input.serviceIds === undefined &&
      input.notes === undefined
    )
      throw new BadRequestException('At least one field is required');
    const current = await this.prisma.appointment.findFirst({
      where: { id, businessId },
      include: { services: true },
    });
    if (!current) throw new NotFoundException();
    if (!reprogrammable.includes(current.status))
      throw new BadRequestException('Appointment cannot be edited');
    let endAt = current.endAt;
    if (input.serviceIds) {
      const start = DateTime.fromJSDate(current.startAt, { zone: 'utc' });
      const slot = await this.requireSlot(
        businessId,
        current.branchId,
        current.employeeId,
        input.serviceIds,
        start,
        id,
      );
      endAt = new Date(slot.endAt);
    }
    return this.transaction(async (tx) => {
      await this.lock(tx, businessId, id);
      if (input.customerId)
        await this.assertCustomer(tx, businessId, input.customerId);
      if (input.serviceIds) {
        const snapshots = await this.snapshots(
          tx,
          businessId,
          current.employeeId,
          input.serviceIds,
        );
        await tx.appointmentService.deleteMany({
          where: { appointmentId: id },
        });
        await tx.appointmentService.createMany({
          data: snapshots.map((snapshot) => ({
            appointmentId: id,
            ...snapshot,
          })),
        });
      }
      const row = await tx.appointment.update({
        where: { id, businessId },
        data: {
          customerId: input.customerId,
          notes:
            input.notes !== undefined ? this.optional(input.notes) : undefined,
          endAt,
        },
        include: detailInclude,
      });
      return this.serialize(row);
    });
  }

  private async reschedule(
    businessId: string,
    userId: string,
    id: string,
    input: UpdateAppointmentDto,
  ) {
    if (
      !input.startAt ||
      input.customerId !== undefined ||
      input.status !== undefined
    )
      throw new BadRequestException('Invalid RESCHEDULE fields');
    const current = await this.prisma.appointment.findFirst({
      where: { id, businessId },
      include: { services: true },
    });
    if (!current) throw new NotFoundException();
    const branchId = input.branchId ?? current.branchId,
      employeeId = input.employeeId ?? current.employeeId,
      serviceIds =
        input.serviceIds ?? current.services.map((item) => item.serviceId);
    const start = this.timezone.utcDate(input.startAt);
    const slot = await this.requireSlot(
      businessId,
      branchId,
      employeeId,
      serviceIds,
      start,
      id,
    );
    return this.transaction(async (tx) => {
      const locked = await this.lock(tx, businessId, id);
      if (!reprogrammable.includes(locked.status))
        throw new ConflictException('Appointment already consumed');
      const snapshots = input.serviceIds
        ? await this.snapshots(tx, businessId, employeeId, serviceIds)
        : current.services.map((item) => ({
            serviceId: item.serviceId,
            serviceNameSnapshot: item.serviceNameSnapshot,
            priceSnapshot: item.priceSnapshot,
            durationMinutesSnapshot: item.durationMinutesSnapshot,
          }));
      await tx.appointment.update({
        where: { id, businessId },
        data: { status: AppointmentStatus.RESCHEDULED },
      });
      const successor = await tx.appointment.create({
        data: {
          businessId,
          branchId,
          customerId: current.customerId,
          employeeId,
          createdByUserId: userId,
          originalAppointmentId: id,
          status: current.status,
          source: 'ADMIN',
          startAt: start.toJSDate(),
          endAt: new Date(slot.endAt),
          notes:
            input.notes !== undefined
              ? this.optional(input.notes)
              : current.notes,
          services: { create: snapshots },
        },
        include: detailInclude,
      });
      return this.serialize(successor);
    });
  }

  private async changeStatus(
    businessId: string,
    id: string,
    input: UpdateAppointmentDto,
  ) {
    if (
      !input.status ||
      input.startAt ||
      input.branchId ||
      input.employeeId ||
      input.customerId ||
      input.serviceIds
    )
      throw new BadRequestException('Invalid STATUS fields');
    const status = input.status;
    return this.transaction(async (tx) => {
      const current = await this.lock(tx, businessId, id);
      this.assertTransition(current.status, status);
      const row = await tx.appointment.update({
        where: { id, businessId },
        data: {
          status,
          notes:
            input.notes !== undefined ? this.optional(input.notes) : undefined,
        },
        include: detailInclude,
      });
      return this.serialize(row);
    });
  }

  private async requireSlot(
    businessId: string,
    branchId: string,
    employeeId: string,
    serviceIds: string[],
    start: DateTime,
    excludeAppointmentId?: string,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    if (!business) throw new NotFoundException();
    const date = start.setZone(business.timezone).toISODate()!;
    const result = await this.availability.get(businessId, {
      branchId,
      employeeId,
      serviceIds,
      from: date,
      to: date,
      excludeAppointmentId,
    });
    const slot = result.days[0]?.slots.find(
      (item) => item.startAt === start.toISO(),
    );
    if (!slot) throw new BadRequestException('Selected time is unavailable');
    return slot;
  }

  private async snapshots(
    tx: Prisma.TransactionClient,
    businessId: string,
    employeeId: string,
    serviceIds: string[],
  ) {
    const rows = await tx.service.findMany({
      where: {
        id: { in: serviceIds },
        businessId,
        active: true,
        employees: { some: { employeeId } },
      },
      select: { id: true, name: true, price: true, durationMinutes: true },
    });
    if (rows.length !== serviceIds.length) throw new NotFoundException();
    const byId = new Map(rows.map((row) => [row.id, row]));
    return serviceIds.map((id) => {
      const service = byId.get(id)!;
      return {
        serviceId: id,
        serviceNameSnapshot: service.name,
        priceSnapshot: service.price,
        durationMinutesSnapshot: service.durationMinutes,
      };
    });
  }
  private async assertCustomer(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
  ) {
    if (
      !(await tx.customer.findFirst({
        where: { id, businessId, active: true },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
  }
  private async lock(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: AppointmentStatus }>
    >(
      Prisma.sql`SELECT id, status FROM "Appointment" WHERE id = ${id}::uuid AND "businessId" = ${businessId}::uuid FOR UPDATE`,
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          this.hasCode(error, '23P01') ||
          this.hasText(error, 'Appointment_employee_blocking_time_excl')
        )
          throw new ConflictException(
            'Appointment time conflicts with another booking',
          );
        if (
          attempt < 2 &&
          (this.hasCode(error, '40001') ||
            this.hasCode(error, '40P01') ||
            this.hasText(error, 'P2034'))
        )
          continue;
        throw error;
      }
    }
  }
  private hasCode(
    error: unknown,
    code: string,
    seen = new WeakSet<object>(),
  ): boolean {
    if (!error || typeof error !== 'object' || seen.has(error)) return false;
    seen.add(error);
    if (Object.values(error).some((value) => value === code)) return true;
    return Object.values(error).some((value) =>
      this.hasCode(value, code, seen),
    );
  }
  private hasText(error: unknown, text: string) {
    return error instanceof Error
      ? error.message.includes(text)
      : typeof error === 'string'
        ? error.includes(text)
        : false;
  }
  private assertTransition(from: AppointmentStatus, to: AppointmentStatus) {
    const allowed: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
      PENDING: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      CONFIRMED: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      IN_PROGRESS: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
    };
    if (!allowed[from]?.includes(to))
      throw new BadRequestException('Invalid status transition');
  }
  private optional(value?: string) {
    return value?.trim() || null;
  }
  private serialize<
    T extends {
      services: Array<{
        priceSnapshot: { toFixed(digits: number): string };
        durationMinutesSnapshot: number;
      }>;
    },
  >(row: T) {
    const services = row.services.map((item) => ({
      ...item,
      priceSnapshot: item.priceSnapshot.toFixed(2),
    }));
    const totalDurationMinutes = row.services.reduce(
      (sum, item) => sum + item.durationMinutesSnapshot,
      0,
    );
    const totalPrice = row.services
      .reduce(
        (sum, item) => sum.plus(item.priceSnapshot.toFixed(2)),
        new Prisma.Decimal(0),
      )
      .toFixed(2);
    return { ...row, services, totalDurationMinutes, totalPrice };
  }
}
