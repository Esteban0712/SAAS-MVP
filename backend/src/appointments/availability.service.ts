import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { AppointmentStatus, DayOfWeek } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { TimezoneService } from './timezone.service';

const blocking: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];
const dayNames: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timezone: TimezoneService,
  ) {}

  async get(businessId: string, query: AvailabilityQueryDto) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    if (!business) throw new NotFoundException();
    this.timezone.assertZone(business.timezone);
    const from = DateTime.fromISO(query.from, { zone: business.timezone });
    const to = DateTime.fromISO(query.to, { zone: business.timezone });
    if (
      !from.isValid ||
      !to.isValid ||
      to < from ||
      to.diff(from, 'days').days > 30
    )
      throw new BadRequestException('Invalid availability range');
    const [branch, employee, services, assignments] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: query.branchId, businessId, active: true },
        select: { id: true },
      }),
      this.prisma.employee.findFirst({
        where: {
          id: query.employeeId,
          businessId,
          branchId: query.branchId,
          active: true,
        },
        select: { id: true },
      }),
      this.prisma.service.findMany({
        where: { id: { in: query.serviceIds }, businessId, active: true },
        select: { id: true, durationMinutes: true },
      }),
      this.prisma.employeeService.count({
        where: {
          employeeId: query.employeeId,
          serviceId: { in: query.serviceIds },
          service: { businessId },
        },
      }),
    ]);
    if (
      !branch ||
      !employee ||
      services.length !== query.serviceIds.length ||
      assignments !== query.serviceIds.length
    )
      throw new NotFoundException();
    if (query.excludeAppointmentId) {
      const own = await this.prisma.appointment.findFirst({
        where: { id: query.excludeAppointmentId, businessId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException();
    }
    const durationMinutes = services.reduce(
      (sum, service) => sum + service.durationMinutes,
      0,
    );
    const schedules = await this.prisma.employeeSchedule.findMany({
      where: { employeeId: query.employeeId, active: true },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    });
    const rangeStart = from.startOf('day').toUTC().toJSDate();
    const rangeEnd = to.plus({ days: 1 }).startOf('day').toUTC().toJSDate();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        employeeId: query.employeeId,
        status: { in: blocking },
        id: query.excludeAppointmentId
          ? { not: query.excludeAppointmentId }
          : undefined,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      select: { startAt: true, endAt: true },
    });
    const days = [] as Array<{
      date: string;
      slots: Array<{
        startAt: string;
        endAt: string;
        localStart: string;
        localEnd: string;
        offset: string;
      }>;
    }>;
    for (
      let cursor = from.startOf('day');
      cursor <= to.startOf('day');
      cursor = cursor.plus({ days: 1 })
    ) {
      const date = cursor.toISODate();
      const day = dayNames[cursor.weekday - 1];
      const slots = [] as (typeof days)[number]['slots'];
      for (const schedule of schedules.filter(
        (item) => item.dayOfWeek === day,
      )) {
        const start = this.minutes(schedule.startTime);
        const end = this.minutes(schedule.endTime);
        for (let minute = start; minute < end; minute += 15) {
          const wall = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;
          for (const instant of this.timezone.possibleInstants(
            date,
            wall,
            business.timezone,
          )) {
            const endInstant = instant.plus({ minutes: durationMinutes });
            const localEnd = endInstant.setZone(business.timezone);
            if (
              localEnd.toISODate() !== date ||
              this.wallMinutes(localEnd) > end
            )
              continue;
            const startDate = instant.toJSDate(),
              endDate = endInstant.toJSDate();
            if (
              appointments.some(
                (item) => item.startAt < endDate && item.endAt > startDate,
              )
            )
              continue;
            slots.push({
              startAt: instant.toISO(),
              endAt: endInstant.toISO(),
              localStart: `${date}T${wall}`,
              localEnd: localEnd.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
              offset: instant.setZone(business.timezone).toFormat('ZZ'),
            });
          }
        }
      }
      slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
      days.push({ date, slots });
    }
    return {
      timezone: business.timezone,
      durationMinutes,
      from: query.from,
      to: query.to,
      days,
    };
  }

  private minutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  private wallMinutes(value: DateTime) {
    return value.hour * 60 + value.minute + value.second / 60;
  }
}
