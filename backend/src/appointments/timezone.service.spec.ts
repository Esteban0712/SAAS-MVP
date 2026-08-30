import { BadRequestException } from '@nestjs/common';
import { TimezoneService } from './timezone.service';
describe('TimezoneService', () => {
  const service = new TimezoneService();
  it('rejects non-UTC appointment input', () => {
    expect(() => service.utcDate('2026-09-07T09:00:00+02:00')).toThrow(
      BadRequestException,
    );
  });
  it('skips nonexistent DST wall times', () => {
    expect(
      service.possibleInstants('2026-03-29', '02:30:00', 'Europe/Malta'),
    ).toHaveLength(0);
  });
  it('returns both instants for an ambiguous DST wall time', () => {
    const values = service.possibleInstants(
      '2026-10-25',
      '02:30:00',
      'Europe/Malta',
    );
    expect(values).toHaveLength(2);
    expect(new Set(values.map((value) => value.toISO())).size).toBe(2);
  });
  it('round-trips UTC to business wall-clock', () => {
    expect(
      service
        .localDate(new Date('2026-09-07T07:00:00.000Z'), 'Europe/Malta')
        .toFormat('HH:mm'),
    ).toBe('09:00');
  });
});
