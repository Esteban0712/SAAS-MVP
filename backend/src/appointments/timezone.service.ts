import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DateTime, IANAZone } from 'luxon';
@Injectable()
export class TimezoneService {
  assertZone(zone: string) {
    if (!IANAZone.isValidZone(zone))
      throw new InternalServerErrorException('Invalid business timezone');
  }
  utcDate(value: string) {
    const dt = DateTime.fromISO(value, { setZone: true });
    if (!dt.isValid || dt.offset !== 0)
      throw new BadRequestException('startAt must be UTC');
    return dt.toUTC();
  }
  localDate(value: Date, zone: string) {
    this.assertZone(zone);
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone);
  }
  possibleInstants(date: string, time: string, zone: string) {
    this.assertZone(zone);
    const normalized = time.slice(0, 8);
    const local = `${date}T${normalized}`;
    const dt = DateTime.fromISO(local, { zone, setZone: true });
    if (!dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local)
      return [];
    return dt.getPossibleOffsets().map((candidate) => candidate.toUTC());
  }
}
