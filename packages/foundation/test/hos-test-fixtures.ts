import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '../src/hos.js';
import { ianaTimeZone } from '../src/time.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  DutyEventType,
  HosCycleType,
  HosDutyStatus,
  SleeperCandidateRole,
} from '../src/hos.js';
import type { HosRegulatoryDayBoundary } from '../src/hos-cycle.js';

export const testProvenance = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'Stage 08 acceptance fixture',
  explanation: 'Deterministic test-only HOS evidence.',
});

const provenance = Object.freeze({
  driver: testProvenance,
  departure: testProvenance,
  dutyStatus: testProvenance,
  clocks: testProvenance,
  dutyHistory: testProvenance,
  sleeper: testProvenance,
  carrierPolicy: testProvenance,
  restPreference: testProvenance,
});

export function addMinutes(instant: string, minutes: number): string {
  return new Date(Date.parse(instant) + minutes * 60_000).toISOString();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localDateAt(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function priorDays(
  departureAt: string,
  timeZone: string,
  cycleType: HosCycleType,
): readonly unknown[] {
  const count = cycleType === 'SEVENTY_HOURS_EIGHT_DAYS' ? 8 : 7;
  const date = localDateAt(departureAt, timeZone);
  return Object.freeze(Array.from({ length: count }, (_, index) => ({
    date: addDays(date, index - count),
    onDutyTime: { value: 0, unit: 'minute' },
  })));
}

export function departureState(
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  const departureAt = typeof overrides.departureAt === 'string'
    ? overrides.departureAt
    : '2026-07-20T00:00:00.000Z';
  const departureTimeZone = typeof overrides.departureTimeZone === 'string'
    ? overrides.departureTimeZone
    : 'UTC';
  const cycleType = (
    overrides.cycleType ?? 'SEVENTY_HOURS_EIGHT_DAYS'
  ) as HosCycleType;
  return validateDriverHosDepartureState({
    driver: { id: 'driver-stage-08', nameOrIdentifier: 'Driver Stage 08' },
    departureAt,
    departureTimeZone,
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: departureAt,
    drivingTimeRemaining: { value: 660, unit: 'minute' },
    shiftTimeRemaining: { value: 840, unit: 'minute' },
    cycleTimeRemaining: {
      value: cycleType === 'SEVENTY_HOURS_EIGHT_DAYS' ? 4200 : 3600,
      unit: 'minute',
    },
    cycleType,
    drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 0, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDays(departureAt, departureTimeZone, cycleType),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 660, unit: 'minute' },
    carrierMaxDuty: { value: 840, unit: 'minute' },
    provenance,
    ...overrides,
  });
}

export interface DutyEventFixtureOptions {
  readonly id: string;
  readonly startAt: string;
  readonly minutes: number;
  readonly dutyStatus: HosDutyStatus;
  readonly eventType?: DutyEventType;
  readonly locationTimeZone?: string;
  readonly qualifiesForThirtyMinuteInterruption?: boolean;
  readonly pairId?: string;
  readonly candidateRole?: SleeperCandidateRole;
}

export function dutyEvent(options: DutyEventFixtureOptions): DutyEvent {
  const driving = options.dutyStatus === 'DRIVING';
  const onDuty = driving || options.dutyStatus === 'ON_DUTY_NOT_DRIVING';
  const participates = options.pairId !== undefined
    && options.candidateRole !== undefined;
  return validateDutyEvent({
    id: options.id,
    startAt: options.startAt,
    endAt: addMinutes(options.startAt, options.minutes),
    duration: { value: options.minutes, unit: 'minute' },
    dutyStatus: options.dutyStatus,
    eventType: options.eventType ?? (
      driving
        ? 'STATUS_CHANGE'
        : options.dutyStatus === 'OFF_DUTY' || options.dutyStatus === 'SLEEPER_BERTH'
          ? 'REST'
          : 'OTHER'
    ),
    location: {
      description: 'Stage 08 deterministic fixture',
      timeZone: options.locationTimeZone ?? 'UTC',
    },
    source: 'USER_ENTERED',
    explanation: `Stage 08 fixture event ${options.id}.`,
    clockEffects: {
      driving: driving ? 'CONSUMES' : 'DOES_NOT_CONSUME',
      shift: options.dutyStatus === 'SLEEPER_BERTH'
        ? 'RULE_DEPENDENT'
        : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption:
      options.qualifiesForThirtyMinuteInterruption
      ?? (!driving && options.minutes >= 30),
    sleeperPair: participates
      ? {
          participates: true,
          pairId: options.pairId,
          candidateRole: options.candidateRole,
        }
      : { participates: false },
    provenance: testProvenance,
  });
}

export interface OnDutyInterval {
  readonly startAt: string;
  readonly endAt: string;
  readonly dutyStatus?: 'DRIVING' | 'ON_DUTY_NOT_DRIVING';
  readonly locationTimeZone?: string;
}

export function completeHistory(
  startAt: string,
  endAt: string,
  intervals: readonly OnDutyInterval[],
): readonly DutyEvent[] {
  const events: DutyEvent[] = [];
  let cursor = startAt;
  intervals.forEach((interval, index) => {
    if (Date.parse(interval.startAt) > Date.parse(cursor)) {
      events.push(dutyEvent({
        id: `history-off-${String(index)}`,
        startAt: cursor,
        minutes: (Date.parse(interval.startAt) - Date.parse(cursor)) / 60_000,
        dutyStatus: 'OFF_DUTY',
      }));
    }
    events.push(dutyEvent({
      id: `history-on-${String(index)}`,
      startAt: interval.startAt,
      minutes: (Date.parse(interval.endAt) - Date.parse(interval.startAt)) / 60_000,
      dutyStatus: interval.dutyStatus ?? 'ON_DUTY_NOT_DRIVING',
      ...(interval.locationTimeZone === undefined
        ? {}
        : { locationTimeZone: interval.locationTimeZone }),
    }));
    cursor = interval.endAt;
  });
  if (Date.parse(cursor) < Date.parse(endAt)) {
    events.push(dutyEvent({
      id: 'history-final-off',
      startAt: cursor,
      minutes: (Date.parse(endAt) - Date.parse(cursor)) / 60_000,
      dutyStatus: 'OFF_DUTY',
    }));
  }
  return Object.freeze(events);
}

export const utcRegulatoryBoundary: HosRegulatoryDayBoundary = Object.freeze({
  timeZone: ianaTimeZone('UTC'),
  localStartTime: '00:00',
  repeatedTimeChoice: 'earlier',
  gapResolution: 'NEXT_VALID_INSTANT',
});
