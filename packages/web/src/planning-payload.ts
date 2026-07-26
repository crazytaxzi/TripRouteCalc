import type { CycleType, DutyStatus, FactProvenance, TripSetupState } from './model.js';

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;
const OFFSET_DATE_TIME_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/u;

interface LocalDateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export class PlanningPayloadError extends Error {
  public override readonly name = 'PlanningPayloadError';

  public constructor(
    public readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

function parseLocalDateTime(value: string, path: string): LocalDateTimeParts {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (match === null) {
    throw new PlanningPayloadError(path, 'Enter a complete local date and time.');
  }
  const parts: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
  };
  const probe = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  if (
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() + 1 !== parts.month ||
    probe.getUTCDate() !== parts.day ||
    probe.getUTCHours() !== parts.hour ||
    probe.getUTCMinutes() !== parts.minute ||
    probe.getUTCSeconds() !== parts.second
  ) {
    throw new PlanningPayloadError(path, 'Enter a valid local date and time.');
  }
  return parts;
}

function formatter(timeZone: string, path: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw new PlanningPayloadError(path, 'Enter a valid IANA time-zone identifier.');
  }
}

function partsAt(
  milliseconds: number,
  dateTimeFormatter: Intl.DateTimeFormat,
): LocalDateTimeParts {
  const values = new Map(
    dateTimeFormatter
      .formatToParts(new Date(milliseconds))
      .map((part): readonly [string, string] => [part.type, part.value]),
  );
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

function sameParts(left: LocalDateTimeParts, right: LocalDateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function offsetMinutesAt(
  milliseconds: number,
  dateTimeFormatter: Intl.DateTimeFormat,
): number {
  const local = partsAt(milliseconds, dateTimeFormatter);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return Math.round((localAsUtc - milliseconds) / 60_000);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizedLocal(parts: LocalDateTimeParts): string {
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formattedOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function localDateTimeWithOffset(
  value: string,
  timeZone: string,
  path: string,
): string {
  if (OFFSET_DATE_TIME_PATTERN.test(value)) {
    if (Number.isNaN(Date.parse(value))) {
      throw new PlanningPayloadError(path, 'Enter a valid timestamp with an explicit offset.');
    }
    return value;
  }

  const local = parseLocalDateTime(value, path);
  const dateTimeFormatter = formatter(timeZone, 'departureTimeZone');
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(offsetMinutesAt(localAsUtc + hours * 3_600_000, dateTimeFormatter));
  }
  const candidates = [...offsets]
    .map((offset) => ({
      offset,
      milliseconds: localAsUtc - offset * 60_000,
    }))
    .filter((candidate) =>
      sameParts(partsAt(candidate.milliseconds, dateTimeFormatter), local),
    );

  if (candidates.length === 0) {
    throw new PlanningPayloadError(
      path,
      'This local time does not exist because of a daylight-saving transition. Choose another time.',
    );
  }
  if (candidates.length > 1) {
    throw new PlanningPayloadError(
      path,
      'This local time occurs twice because of a daylight-saving transition. Enter a timestamp with an explicit offset.',
    );
  }
  const candidate = candidates[0];
  if (candidate === undefined) {
    throw new PlanningPayloadError(path, 'The local time could not be resolved.');
  }
  return `${normalizedLocal(local)}${formattedOffset(candidate.offset)}`;
}

function requiredCycleType(value: CycleType): Exclude<CycleType, ''> {
  if (value === '') {
    throw new PlanningPayloadError('hos.cycleType', 'Choose the driver cycle.');
  }
  return value;
}

function requiredProvenance(value: FactProvenance): Exclude<FactProvenance, ''> {
  if (value === '') {
    throw new PlanningPayloadError('hos.provenance', 'Choose the HOS fact source.');
  }
  return value;
}

function requiredDutyStatus(value: DutyStatus | ''): DutyStatus {
  if (value === '') {
    throw new PlanningPayloadError('currentDutyStatus', 'Choose the current duty status.');
  }
  return value;
}

export function createPlanPayload(state: TripSetupState): Record<string, unknown> {
  const timeZone = state.departureTimeZone;
  return {
    expectedRevisionNumber: state.revisionNumber,
    departureAt: localDateTimeWithOffset(state.departureAt, timeZone, 'departureAt'),
    departureTimeZone: timeZone,
    currentDutyStatus: requiredDutyStatus(state.currentDutyStatus),
    currentDutyStatusBeganAt: localDateTimeWithOffset(
      state.currentDutyStatusBeganAt,
      timeZone,
      'currentDutyStatusBeganAt',
    ),
    clocks: state.clocks,
    hos: {
      cycleType: requiredCycleType(state.hos.cycleType),
      provenance: requiredProvenance(state.hos.provenance),
      drivenSinceQualifyingInterruptionMinutes:
        state.hos.drivenSinceQualifyingInterruptionMinutes,
      onDutyCurrentShiftMinutes: state.hos.onDutyCurrentShiftMinutes,
      offDutyBeforeDepartureMinutes: state.hos.offDutyBeforeDepartureMinutes,
      qualifyingTenHourBreakCompleted: state.hos.qualifyingTenHourBreakCompleted,
      priorDutyTotals: state.hos.priorDutyTotals,
      cycleRecaps: state.hos.cycleRecaps.map((recap, index) => ({
        availableAt: localDateTimeWithOffset(
          recap.availableAt,
          timeZone,
          `hos.cycleRecaps.${String(index)}.availableAt`,
        ),
        minutesReturning: recap.minutesReturning,
      })),
      sleeperBerthEligible: state.hos.sleeperBerthEligible,
      existingSleeperPeriods: state.hos.existingSleeperPeriods.map(
        (period, index) => ({
          startAt: localDateTimeWithOffset(
            period.startAt,
            timeZone,
            `hos.existingSleeperPeriods.${String(index)}.startAt`,
          ),
          endAt: localDateTimeWithOffset(
            period.endAt,
            timeZone,
            `hos.existingSleeperPeriods.${String(index)}.endAt`,
          ),
        }),
      ),
      splitSleeperEnabled: state.hos.splitSleeperEnabled,
      plannedThirtyFourHourRestart: state.hos.plannedThirtyFourHourRestart,
      carrierMaximumDrivingMinutes: state.hos.carrierMaximumDrivingMinutes,
      carrierMaximumDutyMinutes: state.hos.carrierMaximumDutyMinutes,
      restPreference: state.hos.restPreference,
    },
  };
}
