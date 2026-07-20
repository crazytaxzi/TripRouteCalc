import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import {
  formatInstantAtZone,
  ianaTimeZone,
  inspectLocalTime,
  resolveAppointmentWindow,
  resolveZonedLocalDateTime,
  utcInstant,
} from '../src/time.js';

describe('UTC and IANA time foundations', () => {
  it('canonicalizes authoritative instants to UTC', () => {
    expect(utcInstant('2026-07-19T12:00:00-07:00')).toBe(
      '2026-07-19T19:00:00.000Z',
    );
  });

  it('validates IANA zone identifiers', () => {
    expect(ianaTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(() => ianaTimeZone('PST')).toThrow('Invalid IANA time zone');
  });

  it('rejects a missing local time during the spring transition', () => {
    const local = {
      localDateTime: '2026-03-08T02:30',
      timeZone: 'America/Los_Angeles',
    };

    expect(inspectLocalTime(local)).toEqual({ kind: 'gap' });
    expect(() => resolveZonedLocalDateTime(local)).toThrowError(
      expect.objectContaining({ code: 'NONEXISTENT_LOCAL_TIME' }),
    );
  });

  it('requires an explicit choice for a repeated fall-transition time', () => {
    const local = {
      localDateTime: '2026-11-01T01:30',
      timeZone: 'America/Los_Angeles',
    };
    const inspection = inspectLocalTime(local);

    expect(inspection.kind).toBe('repeated');
    expect(() => resolveZonedLocalDateTime(local)).toThrowError(
      expect.objectContaining({ code: 'AMBIGUOUS_LOCAL_TIME' }),
    );

    const earlier = resolveZonedLocalDateTime({
      ...local,
      repeatedTimeChoice: 'earlier',
    });
    const later = resolveZonedLocalDateTime({
      ...local,
      repeatedTimeChoice: 'later',
    });
    const difference = Temporal.Instant.from(later.instant).since(
      Temporal.Instant.from(earlier.instant),
      { largestUnit: 'hour' },
    );

    expect(difference.total('hour')).toBe(1);
  });

  it('resolves appointment windows by the location time zone', () => {
    const window = resolveAppointmentWindow({
      start: {
        localDateTime: '2026-07-20T08:00',
        timeZone: 'America/Chicago',
      },
      end: {
        localDateTime: '2026-07-20T10:00',
        timeZone: 'America/Chicago',
      },
    });

    expect(window.startInstant).toBe('2026-07-20T13:00:00.000Z');
    expect(window.endInstant).toBe('2026-07-20T15:00:00.000Z');
  });

  it('rejects appointment windows that do not move forward in time', () => {
    expect(() =>
      resolveAppointmentWindow({
        start: {
          localDateTime: '2026-07-20T10:00',
          timeZone: 'America/Chicago',
        },
        end: {
          localDateTime: '2026-07-20T09:00',
          timeZone: 'America/Chicago',
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_APPOINTMENT_WINDOW' }),
    );
  });

  it('produces display-only local values without changing the instant', () => {
    const displayed = formatInstantAtZone(
      '2026-07-20T13:00:00Z',
      'America/Chicago',
    );

    expect(displayed.date).toBe('2026-07-20');
    expect(displayed.localDateTime).toBe('2026-07-20T08:00');
    expect(displayed.timeZone).toBe('America/Chicago');
    expect(displayed.timeZoneAbbreviation).not.toBe('');
  });
});
