import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';

export type IanaTimeZone = string & {
  readonly __brand: 'IanaTimeZone';
};

export type UtcInstant = string & {
  readonly __brand: 'UtcInstant';
};

export type LocalDateTime = string & {
  readonly __brand: 'LocalDateTime';
};

export type RepeatedTimeChoice = 'earlier' | 'later';

export type LocalTimeResolution =
  | Readonly<{ kind: 'exact'; instant: UtcInstant }>
  | Readonly<{
      kind: 'repeated';
      earlier: UtcInstant;
      later: UtcInstant;
    }>
  | Readonly<{ kind: 'gap' }>;

export interface ZonedLocalDateTime {
  readonly localDateTime: LocalDateTime;
  readonly timeZone: IanaTimeZone;
  readonly repeatedTimeChoice?: RepeatedTimeChoice;
}

export interface ResolvedZonedLocalDateTime {
  readonly local: ZonedLocalDateTime;
  readonly instant: UtcInstant;
  readonly resolution: 'exact' | RepeatedTimeChoice;
}

export interface LocalAppointmentWindow {
  readonly start: ZonedLocalDateTime;
  readonly end: ZonedLocalDateTime;
}

export interface ResolvedAppointmentWindow {
  readonly local: LocalAppointmentWindow;
  readonly startInstant: UtcInstant;
  readonly endInstant: UtcInstant;
}

export interface DisplayLocalTime {
  readonly date: string;
  readonly localDateTime: string;
  readonly timeZone: IanaTimeZone;
  readonly timeZoneAbbreviation: string;
}

export type TimeResolutionErrorCode =
  | 'INVALID_TIME_ZONE'
  | 'INVALID_UTC_INSTANT'
  | 'INVALID_LOCAL_DATE_TIME'
  | 'NONEXISTENT_LOCAL_TIME'
  | 'AMBIGUOUS_LOCAL_TIME'
  | 'INVALID_APPOINTMENT_WINDOW';

export class TimeResolutionError extends Error {
  public override readonly name = 'TimeResolutionError';

  public constructor(
    public readonly code: TimeResolutionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function toCanonicalInstant(instant: Temporal.Instant): UtcInstant {
  return instant.toString({ smallestUnit: 'millisecond' }) as UtcInstant;
}

export const IanaTimeZoneSchema = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    try {
      Temporal.ZonedDateTime.from({
        timeZone: value,
        year: 2000,
        month: 1,
        day: 1,
        hour: 0,
      });
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected a valid IANA time-zone identifier.',
      });
    }
  })
  .transform((value) => value as IanaTimeZone);

export const UtcInstantSchema = z.string().transform((value, context) => {
  try {
    return toCanonicalInstant(Temporal.Instant.from(value));
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected an ISO 8601 instant with an explicit offset.',
    });
    return z.NEVER;
  }
});

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

export const LocalDateTimeSchema = z.string().transform((value, context) => {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected local date-time format YYYY-MM-DDTHH:mm.',
    });
    return z.NEVER;
  }

  try {
    const parsed = Temporal.PlainDateTime.from(value);
    if (parsed.toString({ smallestUnit: 'minute' }) !== value) {
      throw new RangeError('Local date-time is not canonical.');
    }
    return value as LocalDateTime;
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected a valid calendar local date and time.',
    });
    return z.NEVER;
  }
});

export const RepeatedTimeChoiceSchema = z.enum(['earlier', 'later']);

export const ZonedLocalDateTimeSchema = z
  .object({
    localDateTime: LocalDateTimeSchema,
    timeZone: IanaTimeZoneSchema,
    repeatedTimeChoice: RepeatedTimeChoiceSchema.optional(),
  })
  .strict();

export const LocalAppointmentWindowSchema = z
  .object({
    start: ZonedLocalDateTimeSchema,
    end: ZonedLocalDateTimeSchema,
  })
  .strict();

export function ianaTimeZone(value: unknown): IanaTimeZone {
  try {
    return IanaTimeZoneSchema.parse(value);
  } catch (error) {
    throw new TimeResolutionError(
      'INVALID_TIME_ZONE',
      `Invalid IANA time zone: ${String(value)}`,
      { cause: error },
    );
  }
}

export function utcInstant(value: unknown): UtcInstant {
  try {
    return UtcInstantSchema.parse(value);
  } catch (error) {
    throw new TimeResolutionError(
      'INVALID_UTC_INSTANT',
      `Invalid UTC instant: ${String(value)}`,
      { cause: error },
    );
  }
}

export function localDateTime(value: unknown): LocalDateTime {
  try {
    return LocalDateTimeSchema.parse(value);
  } catch (error) {
    throw new TimeResolutionError(
      'INVALID_LOCAL_DATE_TIME',
      `Invalid local date-time: ${String(value)}`,
      { cause: error },
    );
  }
}

interface ZonedDateTimeFields {
  readonly timeZone: IanaTimeZone;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly microsecond: number;
  readonly nanosecond: number;
}

function zonedDateTimeFields(
  local: LocalDateTime,
  timeZone: IanaTimeZone,
): ZonedDateTimeFields {
  const plain = Temporal.PlainDateTime.from(local);
  return {
    timeZone,
    year: plain.year,
    month: plain.month,
    day: plain.day,
    hour: plain.hour,
    minute: plain.minute,
    second: plain.second,
    millisecond: plain.millisecond,
    microsecond: plain.microsecond,
    nanosecond: plain.nanosecond,
  };
}

function samePlainDateTime(
  value: Temporal.ZonedDateTime,
  expected: Temporal.PlainDateTime,
): boolean {
  return value.toPlainDateTime().equals(expected);
}

export function inspectLocalTime(input: unknown): LocalTimeResolution {
  const parsed = ZonedLocalDateTimeSchema.omit({
    repeatedTimeChoice: true,
  }).parse(input);
  const plain = Temporal.PlainDateTime.from(parsed.localDateTime);
  const fields = zonedDateTimeFields(parsed.localDateTime, parsed.timeZone);
  const earlier = Temporal.ZonedDateTime.from(fields, {
    disambiguation: 'earlier',
  });
  const later = Temporal.ZonedDateTime.from(fields, {
    disambiguation: 'later',
  });

  if (earlier.epochNanoseconds === later.epochNanoseconds) {
    return freeze({ kind: 'exact', instant: toCanonicalInstant(earlier.toInstant()) });
  }

  const earlierMatches = samePlainDateTime(earlier, plain);
  const laterMatches = samePlainDateTime(later, plain);

  if (earlierMatches && laterMatches) {
    return freeze({
      kind: 'repeated',
      earlier: toCanonicalInstant(earlier.toInstant()),
      later: toCanonicalInstant(later.toInstant()),
    });
  }

  return freeze({ kind: 'gap' });
}

export function resolveZonedLocalDateTime(
  input: unknown,
): ResolvedZonedLocalDateTime {
  const parsed = freeze(ZonedLocalDateTimeSchema.parse(input));
  const resolution = inspectLocalTime(parsed);

  if (resolution.kind === 'gap') {
    throw new TimeResolutionError(
      'NONEXISTENT_LOCAL_TIME',
      `${parsed.localDateTime} does not exist in ${parsed.timeZone} because of a clock transition.`,
    );
  }

  if (resolution.kind === 'repeated') {
    if (parsed.repeatedTimeChoice === undefined) {
      throw new TimeResolutionError(
        'AMBIGUOUS_LOCAL_TIME',
        `${parsed.localDateTime} occurs twice in ${parsed.timeZone}; choose earlier or later.`,
      );
    }

    return freeze({
      local: parsed,
      instant:
        parsed.repeatedTimeChoice === 'earlier'
          ? resolution.earlier
          : resolution.later,
      resolution: parsed.repeatedTimeChoice,
    });
  }

  return freeze({
    local: parsed,
    instant: resolution.instant,
    resolution: 'exact',
  });
}

export function resolveAppointmentWindow(
  input: unknown,
): ResolvedAppointmentWindow {
  const local = freeze(LocalAppointmentWindowSchema.parse(input));
  const start = resolveZonedLocalDateTime(local.start);
  const end = resolveZonedLocalDateTime(local.end);

  if (
    Temporal.Instant.compare(
      Temporal.Instant.from(start.instant),
      Temporal.Instant.from(end.instant),
    ) >= 0
  ) {
    throw new TimeResolutionError(
      'INVALID_APPOINTMENT_WINDOW',
      'Appointment-window end must be later than its start.',
    );
  }

  return freeze({
    local,
    startInstant: start.instant,
    endInstant: end.instant,
  });
}

export function formatInstantAtZone(
  instantInput: unknown,
  timeZoneInput: unknown,
): DisplayLocalTime {
  const instant = utcInstant(instantInput);
  const timeZone = ianaTimeZone(timeZoneInput);
  const date = new Date(Temporal.Instant.from(instant).epochMilliseconds);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  const isoDate = `${part('year')}-${part('month')}-${part('day')}`;

  return freeze({
    date: isoDate,
    localDateTime: `${isoDate}T${part('hour')}:${part('minute')}`,
    timeZone,
    timeZoneAbbreviation: part('timeZoneName'),
  });
}
