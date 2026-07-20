import { Temporal } from '@js-temporal/polyfill';

import {
  validateDriverHosDepartureState,
  validateDutyEventHistory,
} from './hos.js';
import type {
  CycleRecapReturn,
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
} from './hos.js';
import { ianaTimeZone, utcInstant } from './time.js';
import type {
  IanaTimeZone,
  RepeatedTimeChoice,
  UtcInstant,
} from './time.js';
import { durationInMinutes } from './units.js';
import type { Duration } from './units.js';

export const STANDARD_PROPERTY_CARRYING_CYCLE_RULES = Object.freeze({
  id: 'US_FEDERAL_PROPERTY_CARRYING_STANDARD_CYCLE' as const,
  revision: 'stage-06-v1' as const,
  limits: Object.freeze({
    SIXTY_HOURS_SEVEN_DAYS: Object.freeze({
      cycleMinutes: 60 * 60,
      consecutiveRegulatoryDays: 7,
    }),
    SEVENTY_HOURS_EIGHT_DAYS: Object.freeze({
      cycleMinutes: 70 * 60,
      consecutiveRegulatoryDays: 8,
    }),
  }),
  restartDurationMinutes: 34 * 60,
  onDutyStatuses: Object.freeze([
    'DRIVING',
    'ON_DUTY_NOT_DRIVING',
  ] as const),
  restartEligibleStatuses: Object.freeze([
    'OFF_DUTY',
    'SLEEPER_BERTH',
  ] as const),
});

export type HosCycleGapResolution =
  | 'PREVIOUS_VALID_INSTANT'
  | 'NEXT_VALID_INSTANT';

export interface HosRegulatoryDayBoundary {
  readonly timeZone: IanaTimeZone;
  readonly localStartTime: string;
  readonly repeatedTimeChoice: RepeatedTimeChoice;
  readonly gapResolution: HosCycleGapResolution;
}

export interface SelectedHistoricalRestart {
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly explanation: string;
}

export interface HosCycleCalculationInput {
  readonly departureState: DriverHosDepartureState;
  readonly historicalDutyEvents: readonly DutyEvent[];
  readonly dutyEvents: readonly DutyEvent[];
  readonly regulatoryDayBoundary: HosRegulatoryDayBoundary;
  readonly selectedHistoricalRestart?: SelectedHistoricalRestart;
}

export type HosCycleValidationIssueCode =
  | 'INVALID_REGULATORY_BOUNDARY'
  | 'INCOMPLETE_HISTORICAL_WINDOW'
  | 'INVALID_SELECTED_RESTART'
  | 'HISTORY_DEPARTURE_MISMATCH';

export interface HosCycleValidationIssue {
  readonly code: HosCycleValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class HosCycleValidationError extends Error {
  public override readonly name = 'HosCycleValidationError';

  public constructor(
    public readonly issues: readonly HosCycleValidationIssue[],
  ) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
}

export type HosCycleDiscrepancyStatus = 'MATCH' | 'DISCREPANCY';

export interface HosCycleReconciliation {
  readonly status: HosCycleDiscrepancyStatus;
  readonly enteredCycleTimeRemaining: Duration;
  readonly derivedCycleTimeRemaining: Duration;
  readonly enteredMinusDerived: number;
  readonly explanation: string;
}

export interface HosRecapMismatch {
  readonly sourceDate: string;
  readonly kind: 'MISSING_ENTERED' | 'EXTRA_ENTERED' | 'VALUE_MISMATCH';
  readonly derivedAvailableAt?: UtcInstant;
  readonly enteredAvailableAt?: UtcInstant;
  readonly derivedReturnedTime?: Duration;
  readonly enteredReturnedTime?: Duration;
  readonly explanation: string;
}

export interface HosRecapReconciliation {
  readonly status: HosCycleDiscrepancyStatus;
  readonly mismatches: readonly HosRecapMismatch[];
  readonly explanation: string;
}

export type HosBoundaryResolution = 'EXACT' | 'REPEATED_EARLIER' |
  'REPEATED_LATER' | 'GAP_PREVIOUS' | 'GAP_NEXT';

export interface HosRegulatoryDay {
  readonly date: string;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly startResolution: HosBoundaryResolution;
  readonly endResolution: HosBoundaryResolution;
  readonly onDutyTime: Duration;
}

export type HosCycleAvailabilityEventKind = 'RECAP' | 'THIRTY_FOUR_HOUR_RESTART';
export type HosCycleAvailabilityEventState = 'APPLIED' | 'PENDING' | 'SUPERSEDED';

export interface HosCycleAvailabilityEvent {
  readonly kind: HosCycleAvailabilityEventKind;
  readonly availableAt: UtcInstant;
  readonly sourceDate?: string;
  readonly sourceDayEndAt?: UtcInstant;
  readonly availableTime: Duration;
  readonly appliedTime: Duration;
  readonly state: HosCycleAvailabilityEventState;
  readonly explanation: string;
}

export interface HosCycleBlockingReason {
  readonly code: 'CYCLE_LIMIT_REACHED';
  readonly explanation: string;
}

export interface HosCycleClockSnapshot {
  readonly at: UtcInstant;
  readonly cycleTimeRemaining: Duration;
  readonly canPerformOnDutyWork: boolean;
  readonly canDriveFromCyclePerspective: boolean;
  readonly blockingReasons: readonly HosCycleBlockingReason[];
}

export type HosCycleViolationCode =
  | 'CYCLE_DRIVING_LIMIT_EXCEEDED'
  | 'CYCLE_ON_DUTY_LIMIT_EXCEEDED';

export interface HosCycleViolation {
  readonly code: HosCycleViolationCode;
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly prohibitedOnDutyTime: Duration;
  readonly explanation: string;
}

export interface HosCycleTransition {
  readonly event: DutyEvent;
  readonly before: HosCycleClockSnapshot;
  readonly after: HosCycleClockSnapshot;
  readonly legalOnDutyTime: Duration;
  readonly prohibitedOnDutyTime: Duration;
  readonly availabilityEvents: readonly HosCycleAvailabilityEvent[];
  readonly violations: readonly HosCycleViolation[];
  readonly reasons: readonly string[];
}

export type HosCycleNextAvailabilityCode =
  | 'NONE_REQUIRED'
  | 'WAIT_FOR_RECAP'
  | 'COMPLETE_PLANNED_THIRTY_FOUR_HOUR_RESTART'
  | 'START_OR_CONTINUE_PLANNED_THIRTY_FOUR_HOUR_RESTART'
  | 'NO_KNOWN_CYCLE_AVAILABILITY';

export interface HosCycleNextAvailability {
  readonly code: HosCycleNextAvailabilityCode;
  readonly availableAt?: UtcInstant;
  readonly minimumAdditionalRest?: Duration;
  readonly explanation: string;
}

export interface HosCycleCalculationResult {
  readonly ruleSet: typeof STANDARD_PROPERTY_CARRYING_CYCLE_RULES;
  readonly regulatoryDayBoundary: HosRegulatoryDayBoundary;
  readonly regulatoryWindow: readonly HosRegulatoryDay[];
  readonly selectedHistoricalRestart?: Readonly<{
    readonly startAt: UtcInstant;
    readonly completedAt: UtcInstant;
    readonly suppliedEndAt: UtcInstant;
    readonly explanation: string;
  }>;
  readonly cycleReconciliation: HosCycleReconciliation;
  readonly recapReconciliation: HosRecapReconciliation;
  readonly initial: HosCycleClockSnapshot;
  readonly transitions: readonly HosCycleTransition[];
  readonly final: HosCycleClockSnapshot;
  readonly availabilityEvents: readonly HosCycleAvailabilityEvent[];
  readonly violations: readonly HosCycleViolation[];
  readonly nextCycleAvailability: HosCycleNextAvailability;
  readonly reasons: readonly string[];
}

interface ResolvedBoundary {
  readonly at: UtcInstant;
  readonly resolution: HosBoundaryResolution;
}

interface MutableDayBucket {
  date: string;
  startAt: UtcInstant;
  endAt: UtcInstant;
  startResolution: HosBoundaryResolution;
  endResolution: HosBoundaryResolution;
  onDutyMinutes: number;
}

interface AvailabilitySeed {
  readonly kind: HosCycleAvailabilityEventKind;
  readonly availableAt: UtcInstant;
  readonly availableMinutes: number;
  readonly sourceDate?: string;
  readonly sourceDayEndAt?: UtcInstant;
  readonly explanation: string;
}

interface MutableAvailabilityEvent extends AvailabilitySeed {
  appliedMinutes: number;
  state: HosCycleAvailabilityEventState;
}

interface SimulationState {
  at: UtcInstant;
  remainingMinutes: number;
  lastRestartCompletedAt?: UtcInstant;
}

const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function duration(minutes: number): Duration {
  return durationInMinutes(Math.max(0, minutes));
}

function instantMilliseconds(value: UtcInstant): number {
  return Temporal.Instant.from(value).epochMilliseconds;
}

function compareInstants(left: UtcInstant, right: UtcInstant): number {
  return Temporal.Instant.compare(
    Temporal.Instant.from(left),
    Temporal.Instant.from(right),
  );
}

function addMinutes(value: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(
    Temporal.Instant.from(value).add({ minutes }).toString({
      smallestUnit: 'millisecond',
    }),
  );
}

function exactMinutes(startAt: UtcInstant, endAt: UtcInstant): number {
  const milliseconds = instantMilliseconds(endAt) - instantMilliseconds(startAt);
  if (milliseconds < 0 || milliseconds % 60_000 !== 0) {
    throw new HosCycleValidationError([freeze({
      code: 'INVALID_SELECTED_RESTART',
      path: 'selectedHistoricalRestart',
      message: 'Restart timestamps must move forward on whole-minute boundaries.',
    })]);
  }
  return milliseconds / 60_000;
}

function parseBoundary(input: HosRegulatoryDayBoundary): HosRegulatoryDayBoundary {
  const issues: HosCycleValidationIssue[] = [];
  let timeZone: IanaTimeZone;
  try {
    timeZone = ianaTimeZone(input.timeZone);
  } catch {
    issues.push(freeze({
      code: 'INVALID_REGULATORY_BOUNDARY',
      path: 'regulatoryDayBoundary.timeZone',
      message: 'Expected a valid IANA home-terminal time zone.',
    }));
    timeZone = 'UTC' as IanaTimeZone;
  }
  if (!LOCAL_TIME_PATTERN.test(input.localStartTime)) {
    issues.push(freeze({
      code: 'INVALID_REGULATORY_BOUNDARY',
      path: 'regulatoryDayBoundary.localStartTime',
      message: 'Expected a carrier-designated local boundary in HH:mm format.',
    }));
  }
  if (!['earlier', 'later'].includes(input.repeatedTimeChoice)) {
    issues.push(freeze({
      code: 'INVALID_REGULATORY_BOUNDARY',
      path: 'regulatoryDayBoundary.repeatedTimeChoice',
      message: 'Repeated local boundaries require an explicit earlier or later choice.',
    }));
  }
  if (!['PREVIOUS_VALID_INSTANT', 'NEXT_VALID_INSTANT'].includes(
    input.gapResolution,
  )) {
    issues.push(freeze({
      code: 'INVALID_REGULATORY_BOUNDARY',
      path: 'regulatoryDayBoundary.gapResolution',
      message: 'Nonexistent local boundaries require an explicit previous-valid or next-valid resolution.',
    }));
  }
  if (issues.length > 0) throw new HosCycleValidationError(freeze(issues));
  return freeze({
    timeZone,
    localStartTime: input.localStartTime,
    repeatedTimeChoice: input.repeatedTimeChoice,
    gapResolution: input.gapResolution,
  });
}

function localTimeParts(localStartTime: string): Readonly<{
  hour: number;
  minute: number;
}> {
  const [hourText = '0', minuteText = '0'] = localStartTime.split(':');
  return freeze({ hour: Number(hourText), minute: Number(minuteText) });
}

function canonicalInstant(value: Temporal.Instant): UtcInstant {
  return utcInstant(value.toString({ smallestUnit: 'millisecond' }));
}

function resolveBoundary(
  date: Temporal.PlainDate,
  boundary: HosRegulatoryDayBoundary,
): ResolvedBoundary {
  const { hour, minute } = localTimeParts(boundary.localStartTime);
  const fields = {
    timeZone: boundary.timeZone,
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  };
  const expected = Temporal.PlainDateTime.from({
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
  });
  const earlier = Temporal.ZonedDateTime.from(fields, {
    disambiguation: 'earlier',
  });
  const later = Temporal.ZonedDateTime.from(fields, {
    disambiguation: 'later',
  });
  if (earlier.epochNanoseconds === later.epochNanoseconds) {
    return freeze({
      at: canonicalInstant(earlier.toInstant()),
      resolution: 'EXACT',
    });
  }
  const earlierMatches = earlier.toPlainDateTime().equals(expected);
  const laterMatches = later.toPlainDateTime().equals(expected);
  if (earlierMatches && laterMatches) {
    const selected = boundary.repeatedTimeChoice === 'earlier' ? earlier : later;
    return freeze({
      at: canonicalInstant(selected.toInstant()),
      resolution: boundary.repeatedTimeChoice === 'earlier'
        ? 'REPEATED_EARLIER'
        : 'REPEATED_LATER',
    });
  }
  const selectPrevious = boundary.gapResolution === 'PREVIOUS_VALID_INSTANT';
  return freeze({
    at: canonicalInstant((selectPrevious ? earlier : later).toInstant()),
    resolution: selectPrevious ? 'GAP_PREVIOUS' : 'GAP_NEXT',
  });
}

function localDateAt(
  instant: UtcInstant,
  timeZone: IanaTimeZone,
): Temporal.PlainDate {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
}

function regulatoryDateAt(
  instant: UtcInstant,
  boundary: HosRegulatoryDayBoundary,
): Temporal.PlainDate {
  const localDate = localDateAt(instant, boundary.timeZone);
  const sameDateBoundary = resolveBoundary(localDate, boundary);
  return compareInstants(instant, sameDateBoundary.at) < 0
    ? localDate.subtract({ days: 1 })
    : localDate;
}

function regulatoryDayForDate(
  date: Temporal.PlainDate,
  boundary: HosRegulatoryDayBoundary,
): Omit<HosRegulatoryDay, 'onDutyTime'> {
  const start = resolveBoundary(date, boundary);
  const end = resolveBoundary(date.add({ days: 1 }), boundary);
  return freeze({
    date: date.toString(),
    startAt: start.at,
    endAt: end.at,
    startResolution: start.resolution,
    endResolution: end.resolution,
  });
}

function isOnDuty(status: HosDutyStatus): boolean {
  return status === 'DRIVING' || status === 'ON_DUTY_NOT_DRIVING';
}

function isRestartEligible(status: HosDutyStatus): boolean {
  return status === 'OFF_DUTY' || status === 'SLEEPER_BERTH';
}

function maxInstant(left: UtcInstant, right: UtcInstant): UtcInstant {
  return compareInstants(left, right) >= 0 ? left : right;
}

function minInstant(left: UtcInstant, right: UtcInstant): UtcInstant {
  return compareInstants(left, right) <= 0 ? left : right;
}

function validateHistoryCoverage(
  history: readonly DutyEvent[],
  windowStartAt: UtcInstant,
  departureAt: UtcInstant,
): void {
  const issues: HosCycleValidationIssue[] = [];
  const first = history[0];
  const last = history.at(-1);
  if (first === undefined || compareInstants(first.startAt, windowStartAt) > 0) {
    issues.push(freeze({
      code: 'INCOMPLETE_HISTORICAL_WINDOW',
      path: 'historicalDutyEvents',
      message: `Timestamped duty history must begin at or before ${windowStartAt}.`,
    }));
  }
  if (last === undefined || compareInstants(last.endAt, departureAt) !== 0) {
    issues.push(freeze({
      code: 'HISTORY_DEPARTURE_MISMATCH',
      path: 'historicalDutyEvents',
      message: 'Timestamped duty history must end exactly at departure.',
    }));
  }
  if (issues.length > 0) throw new HosCycleValidationError(freeze(issues));
}

function validateSelectedRestart(
  selected: SelectedHistoricalRestart | undefined,
  history: readonly DutyEvent[],
  departureAt: UtcInstant,
): Readonly<{
  startAt: UtcInstant;
  completedAt: UtcInstant;
  suppliedEndAt: UtcInstant;
  explanation: string;
}> | undefined {
  if (selected === undefined) return undefined;
  const startAt = utcInstant(selected.startAt);
  const endAt = utcInstant(selected.endAt);
  const totalMinutes = exactMinutes(startAt, endAt);
  const issues: HosCycleValidationIssue[] = [];
  if (totalMinutes < STANDARD_PROPERTY_CARRYING_CYCLE_RULES.restartDurationMinutes) {
    issues.push(freeze({
      code: 'INVALID_SELECTED_RESTART',
      path: 'selectedHistoricalRestart',
      message: 'The selected restart must contain at least 2,040 consecutive off-duty or sleeper-berth minutes.',
    }));
  }
  if (compareInstants(endAt, departureAt) > 0) {
    issues.push(freeze({
      code: 'INVALID_SELECTED_RESTART',
      path: 'selectedHistoricalRestart.endAt',
      message: 'A historical restart cannot end after departure.',
    }));
  }
  let cursor = startAt;
  for (const event of history) {
    if (compareInstants(event.endAt, cursor) <= 0) continue;
    if (compareInstants(event.startAt, endAt) >= 0) break;
    const segmentStart = maxInstant(event.startAt, cursor);
    if (compareInstants(segmentStart, cursor) !== 0) {
      issues.push(freeze({
        code: 'INVALID_SELECTED_RESTART',
        path: 'selectedHistoricalRestart',
        message: 'The selected restart is not fully covered by contiguous duty history.',
      }));
      break;
    }
    if (!isRestartEligible(event.dutyStatus)) {
      issues.push(freeze({
        code: 'INVALID_SELECTED_RESTART',
        path: 'selectedHistoricalRestart',
        message: `Duty event ${event.id} interrupts the selected restart with ${event.dutyStatus}.`,
      }));
      break;
    }
    cursor = minInstant(event.endAt, endAt);
    if (compareInstants(cursor, endAt) === 0) break;
  }
  if (compareInstants(cursor, endAt) !== 0) {
    issues.push(freeze({
      code: 'INVALID_SELECTED_RESTART',
      path: 'selectedHistoricalRestart',
      message: 'The selected restart does not have complete timestamped evidence.',
    }));
  }
  if (selected.explanation.trim() === '') {
    issues.push(freeze({
      code: 'INVALID_SELECTED_RESTART',
      path: 'selectedHistoricalRestart.explanation',
      message: 'An explicitly selected restart requires an explanation.',
    }));
  }
  if (issues.length > 0) throw new HosCycleValidationError(freeze(issues));
  return freeze({
    startAt,
    completedAt: addMinutes(
      startAt,
      STANDARD_PROPERTY_CARRYING_CYCLE_RULES.restartDurationMinutes,
    ),
    suppliedEndAt: endAt,
    explanation: selected.explanation,
  });
}

function addEventMinutesToBuckets(
  buckets: Map<string, MutableDayBucket>,
  events: readonly DutyEvent[],
  boundary: HosRegulatoryDayBoundary,
  clipStart?: UtcInstant,
  clipEnd?: UtcInstant,
): void {
  for (const event of events) {
    if (!isOnDuty(event.dutyStatus)) continue;
    let cursor = clipStart === undefined
      ? event.startAt
      : maxInstant(event.startAt, clipStart);
    const endAt = clipEnd === undefined
      ? event.endAt
      : minInstant(event.endAt, clipEnd);
    if (compareInstants(cursor, endAt) >= 0) continue;
    while (compareInstants(cursor, endAt) < 0) {
      const date = regulatoryDateAt(cursor, boundary);
      const day = regulatoryDayForDate(date, boundary);
      const segmentEnd = minInstant(endAt, day.endAt);
      const minutes = exactMinutes(cursor, segmentEnd);
      const existing = buckets.get(day.date);
      if (existing === undefined) {
        buckets.set(day.date, {
          ...day,
          onDutyMinutes: minutes,
        });
      } else {
        existing.onDutyMinutes += minutes;
      }
      cursor = segmentEnd;
    }
  }
}

function completeWindowDays(
  currentDate: Temporal.PlainDate,
  cycleDays: number,
  boundary: HosRegulatoryDayBoundary,
  buckets: ReadonlyMap<string, MutableDayBucket>,
): readonly HosRegulatoryDay[] {
  const days: HosRegulatoryDay[] = [];
  for (let offset = cycleDays - 1; offset >= 0; offset -= 1) {
    const date = currentDate.subtract({ days: offset });
    const day = regulatoryDayForDate(date, boundary);
    days.push(freeze({
      ...day,
      onDutyTime: duration(buckets.get(day.date)?.onDutyMinutes ?? 0),
    }));
  }
  return freeze(days);
}

function recapSeeds(
  buckets: ReadonlyMap<string, MutableDayBucket>,
  cycleDays: number,
  boundary: HosRegulatoryDayBoundary,
  departureAt: UtcInstant,
): readonly AvailabilitySeed[] {
  const seeds: AvailabilitySeed[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.onDutyMinutes <= 0) continue;
    const sourceDate = Temporal.PlainDate.from(bucket.date);
    const available = resolveBoundary(
      sourceDate.add({ days: cycleDays }),
      boundary,
    );
    if (compareInstants(available.at, departureAt) <= 0) continue;
    seeds.push(freeze({
      kind: 'RECAP',
      availableAt: available.at,
      availableMinutes: bucket.onDutyMinutes,
      sourceDate: bucket.date,
      sourceDayEndAt: bucket.endAt,
      explanation: `${String(bucket.onDutyMinutes)} cycle minute(s) from regulatory day ${bucket.date} return at the carrier-designated boundary.`,
    }));
  }
  return freeze(seeds.sort((left, right) =>
    compareInstants(left.availableAt, right.availableAt)
    || (left.sourceDate ?? '').localeCompare(right.sourceDate ?? '')));
}

function trailingRestartStreakStart(
  events: readonly DutyEvent[],
  at: UtcInstant,
): UtcInstant | undefined {
  let cursor = at;
  let start: UtcInstant | undefined;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined || compareInstants(event.endAt, cursor) !== 0) break;
    if (!isRestartEligible(event.dutyStatus)) break;
    start = event.startAt;
    cursor = event.startAt;
  }
  return start;
}

function plannedRestartSeed(
  departureState: DriverHosDepartureState,
  historicalEvents: readonly DutyEvent[],
  plannedEvents: readonly DutyEvent[],
): AvailabilitySeed | undefined {
  if (!departureState.restart34HourPlanned) return undefined;
  let streakStart = trailingRestartStreakStart(
    historicalEvents,
    departureState.departureAt,
  );
  for (const event of plannedEvents) {
    if (!isRestartEligible(event.dutyStatus)) {
      streakStart = undefined;
      continue;
    }
    streakStart ??= event.startAt;
    const completedAt = addMinutes(
      streakStart,
      STANDARD_PROPERTY_CARRYING_CYCLE_RULES.restartDurationMinutes,
    );
    if (
      compareInstants(completedAt, departureState.departureAt) > 0
      && compareInstants(completedAt, event.endAt) <= 0
    ) {
      return freeze({
        kind: 'THIRTY_FOUR_HOUR_RESTART',
        availableAt: completedAt,
        availableMinutes: STANDARD_PROPERTY_CARRYING_CYCLE_RULES.limits[
          departureState.cycleType
        ].cycleMinutes,
        explanation: `The explicitly planned 34-consecutive-hour restart completes at ${completedAt}.`,
      });
    }
  }
  return undefined;
}

function reconcileCycle(
  enteredMinutes: number,
  derivedMinutes: number,
): HosCycleReconciliation {
  const difference = enteredMinutes - derivedMinutes;
  const status: HosCycleDiscrepancyStatus = difference === 0
    ? 'MATCH'
    : 'DISCREPANCY';
  return freeze({
    status,
    enteredCycleTimeRemaining: duration(enteredMinutes),
    derivedCycleTimeRemaining: duration(derivedMinutes),
    enteredMinusDerived: difference,
    explanation: difference === 0
      ? 'The entered cycle clock agrees with the timestamped rolling history.'
      : `The entered cycle clock differs from timestamped history by ${String(difference)} minute(s). The calculation preserves the entered fact and uses the derived history result for the Stage 06 cycle timeline.`,
  });
}

function recapKey(value: Pick<CycleRecapReturn, 'sourceDate'>): string {
  return value.sourceDate;
}

function reconcileRecaps(
  entered: readonly CycleRecapReturn[],
  derivedSeeds: readonly AvailabilitySeed[],
): HosRecapReconciliation {
  const mismatches: HosRecapMismatch[] = [];
  const enteredByDate = new Map(entered.map((value) => [recapKey(value), value]));
  const derivedByDate = new Map(
    derivedSeeds
      .filter((value) => value.kind === 'RECAP' && value.sourceDate !== undefined)
      .map((value) => [value.sourceDate as string, value]),
  );
  for (const [sourceDate, derived] of derivedByDate) {
    const enteredValue = enteredByDate.get(sourceDate);
    if (enteredValue === undefined) {
      mismatches.push(freeze({
        sourceDate,
        kind: 'MISSING_ENTERED',
        derivedAvailableAt: derived.availableAt,
        derivedReturnedTime: duration(derived.availableMinutes),
        explanation: 'Timestamped history produces a recap that was not present in the entered recap list.',
      }));
      continue;
    }
    if (
      compareInstants(enteredValue.availableAt, derived.availableAt) !== 0
      || enteredValue.returnedTime.value !== derived.availableMinutes
    ) {
      mismatches.push(freeze({
        sourceDate,
        kind: 'VALUE_MISMATCH',
        derivedAvailableAt: derived.availableAt,
        enteredAvailableAt: enteredValue.availableAt,
        derivedReturnedTime: duration(derived.availableMinutes),
        enteredReturnedTime: enteredValue.returnedTime,
        explanation: 'The entered recap timestamp or returned minutes do not agree with the regulatory-day history.',
      }));
    }
  }
  for (const [sourceDate, enteredValue] of enteredByDate) {
    if (derivedByDate.has(sourceDate)) continue;
    mismatches.push(freeze({
      sourceDate,
      kind: 'EXTRA_ENTERED',
      enteredAvailableAt: enteredValue.availableAt,
      enteredReturnedTime: enteredValue.returnedTime,
      explanation: 'The entered recap list contains a return that timestamped history does not derive.',
    }));
  }
  return freeze({
    status: mismatches.length === 0 ? 'MATCH' : 'DISCREPANCY',
    mismatches: freeze(mismatches),
    explanation: mismatches.length === 0
      ? 'Entered recap returns agree with timestamped history and the configured regulatory boundary.'
      : 'Entered recap returns were preserved, but the Stage 06 timeline uses recap events derived from timestamped history.',
  });
}

function snapshot(state: SimulationState): HosCycleClockSnapshot {
  const blocked = state.remainingMinutes <= 0;
  const reasons: HosCycleBlockingReason[] = blocked
    ? [freeze({
      code: 'CYCLE_LIMIT_REACHED',
      explanation: 'No derived 60-hour/7-day or 70-hour/8-day cycle time remains for additional on-duty work.',
    })]
    : [];
  return freeze({
    at: state.at,
    cycleTimeRemaining: duration(state.remainingMinutes),
    canPerformOnDutyWork: !blocked,
    canDriveFromCyclePerspective: !blocked,
    blockingReasons: freeze(reasons),
  });
}

function materializeAvailabilityEvent(
  value: MutableAvailabilityEvent,
): HosCycleAvailabilityEvent {
  return freeze({
    kind: value.kind,
    availableAt: value.availableAt,
    ...(value.sourceDate === undefined ? {} : { sourceDate: value.sourceDate }),
    ...(value.sourceDayEndAt === undefined
      ? {}
      : { sourceDayEndAt: value.sourceDayEndAt }),
    availableTime: duration(value.availableMinutes),
    appliedTime: duration(value.appliedMinutes),
    state: value.state,
    explanation: value.explanation,
  });
}

function applyAvailabilityAt(
  state: SimulationState,
  events: MutableAvailabilityEvent[],
  at: UtcInstant,
  cycleLimit: number,
): readonly HosCycleAvailabilityEvent[] {
  const applied: HosCycleAvailabilityEvent[] = [];
  for (const event of events) {
    if (event.state !== 'PENDING' || compareInstants(event.availableAt, at) !== 0) {
      continue;
    }
    if (event.kind === 'THIRTY_FOUR_HOUR_RESTART') {
      event.appliedMinutes = Math.max(0, cycleLimit - state.remainingMinutes);
      state.remainingMinutes = cycleLimit;
      state.lastRestartCompletedAt = at;
      event.state = 'APPLIED';
      applied.push(materializeAvailabilityEvent(event));
      continue;
    }
    if (
      state.lastRestartCompletedAt !== undefined
      && event.sourceDayEndAt !== undefined
      && compareInstants(event.sourceDayEndAt, state.lastRestartCompletedAt) <= 0
    ) {
      event.appliedMinutes = 0;
      event.state = 'SUPERSEDED';
      applied.push(materializeAvailabilityEvent(event));
      continue;
    }
    const added = Math.min(
      event.availableMinutes,
      Math.max(0, cycleLimit - state.remainingMinutes),
    );
    event.appliedMinutes = added;
    state.remainingMinutes += added;
    event.state = 'APPLIED';
    applied.push(materializeAvailabilityEvent(event));
  }
  return freeze(applied);
}

function nextPendingAtOrBefore(
  events: readonly MutableAvailabilityEvent[],
  after: UtcInstant,
  endAt: UtcInstant,
): UtcInstant | undefined {
  return events.find((event) =>
    event.state === 'PENDING'
    && compareInstants(event.availableAt, after) > 0
    && compareInstants(event.availableAt, endAt) <= 0)?.availableAt;
}

function makeViolation(
  event: DutyEvent,
  occurredAt: UtcInstant,
  prohibitedMinutes: number,
): HosCycleViolation {
  const driving = event.dutyStatus === 'DRIVING';
  return freeze({
    code: driving
      ? 'CYCLE_DRIVING_LIMIT_EXCEEDED'
      : 'CYCLE_ON_DUTY_LIMIT_EXCEEDED',
    eventId: event.id,
    occurredAt,
    prohibitedOnDutyTime: duration(prohibitedMinutes),
    explanation: driving
      ? 'Driving was planned after derived cycle availability reached zero.'
      : 'On-duty-not-driving work was planned after derived cycle availability reached zero.',
  });
}

function simulate(
  departureAt: UtcInstant,
  initialMinutes: number,
  cycleLimit: number,
  dutyEvents: readonly DutyEvent[],
  availabilitySeeds: readonly AvailabilitySeed[],
): Readonly<{
  initial: HosCycleClockSnapshot;
  transitions: readonly HosCycleTransition[];
  final: HosCycleClockSnapshot;
  availabilityEvents: readonly HosCycleAvailabilityEvent[];
  violations: readonly HosCycleViolation[];
  state: SimulationState;
}> {
  const state: SimulationState = {
    at: departureAt,
    remainingMinutes: initialMinutes,
  };
  const availabilityEvents: MutableAvailabilityEvent[] = availabilitySeeds
    .map((seed) => ({
      ...seed,
      appliedMinutes: 0,
      state: 'PENDING' as const,
    }))
    .sort((left, right) => {
      const compared = compareInstants(left.availableAt, right.availableAt);
      if (compared !== 0) return compared;
      return left.kind === right.kind
        ? 0
        : left.kind === 'THIRTY_FOUR_HOUR_RESTART' ? -1 : 1;
    });
  const initial = snapshot(state);
  const transitions: HosCycleTransition[] = [];
  const allViolations: HosCycleViolation[] = [];

  for (const event of dutyEvents) {
    state.at = event.startAt;
    const before = snapshot(state);
    const appliedDuringEvent: HosCycleAvailabilityEvent[] = [];
    appliedDuringEvent.push(...applyAvailabilityAt(
      state,
      availabilityEvents,
      event.startAt,
      cycleLimit,
    ));
    let cursor = event.startAt;
    let legalMinutes = 0;
    let prohibitedMinutes = 0;
    let firstProhibitedAt: UtcInstant | undefined;
    while (compareInstants(cursor, event.endAt) < 0) {
      const nextAvailability = nextPendingAtOrBefore(
        availabilityEvents,
        cursor,
        event.endAt,
      );
      const segmentEnd = nextAvailability ?? event.endAt;
      const segmentMinutes = exactMinutes(cursor, segmentEnd);
      if (isOnDuty(event.dutyStatus)) {
        const legalSegment = Math.min(segmentMinutes, state.remainingMinutes);
        const prohibitedSegment = segmentMinutes - legalSegment;
        legalMinutes += legalSegment;
        prohibitedMinutes += prohibitedSegment;
        if (prohibitedSegment > 0 && firstProhibitedAt === undefined) {
          firstProhibitedAt = addMinutes(cursor, legalSegment);
        }
        state.remainingMinutes = Math.max(
          0,
          state.remainingMinutes - segmentMinutes,
        );
      }
      cursor = segmentEnd;
      state.at = cursor;
      appliedDuringEvent.push(...applyAvailabilityAt(
        state,
        availabilityEvents,
        cursor,
        cycleLimit,
      ));
    }
    state.at = event.endAt;
    const transitionViolations = firstProhibitedAt === undefined
      ? []
      : [makeViolation(event, firstProhibitedAt, prohibitedMinutes)];
    allViolations.push(...transitionViolations);
    const reasons: string[] = [];
    if (isOnDuty(event.dutyStatus)) {
      reasons.push(
        `${String(event.duration.value)} on-duty minute(s) were evaluated against rolling cycle availability.`,
      );
      reasons.push(
        prohibitedMinutes === 0
          ? 'The complete on-duty event remained within the derived cycle limit.'
          : `${String(prohibitedMinutes)} minute(s) occurred after cycle availability reached zero.`,
      );
    } else {
      reasons.push('Off-duty and sleeper-berth time did not consume cycle availability.');
    }
    if (appliedDuringEvent.length > 0) {
      reasons.push(
        `${String(appliedDuringEvent.length)} cycle availability event(s) occurred during this duty event.`,
      );
    }
    transitions.push(freeze({
      event,
      before,
      after: snapshot(state),
      legalOnDutyTime: duration(legalMinutes),
      prohibitedOnDutyTime: duration(prohibitedMinutes),
      availabilityEvents: freeze(appliedDuringEvent),
      violations: freeze(transitionViolations),
      reasons: freeze(reasons),
    }));
  }

  const final = snapshot(state);
  return freeze({
    initial,
    transitions: freeze(transitions),
    final,
    availabilityEvents: freeze(
      availabilityEvents.map(materializeAvailabilityEvent),
    ),
    violations: freeze(allViolations),
    state,
  });
}

function trailingRestartMinutes(
  historicalEvents: readonly DutyEvent[],
  dutyEvents: readonly DutyEvent[],
  finalAt: UtcInstant,
): number {
  const combined = [...historicalEvents, ...dutyEvents];
  const start = trailingRestartStreakStart(combined, finalAt);
  return start === undefined ? 0 : exactMinutes(start, finalAt);
}

function nextCycleAvailability(
  final: HosCycleClockSnapshot,
  events: readonly HosCycleAvailabilityEvent[],
  restartPlanned: boolean,
  trailingRestMinutes: number,
): HosCycleNextAvailability {
  if (final.cycleTimeRemaining.value > 0) {
    return freeze({
      code: 'NONE_REQUIRED',
      explanation: 'Derived cycle availability remains for additional on-duty work.',
    });
  }
  const pending = events
    .filter((event) => event.state === 'PENDING')
    .sort((left, right) => compareInstants(left.availableAt, right.availableAt));
  const earliest = pending[0];
  if (earliest !== undefined) {
    if (earliest.kind === 'RECAP') {
      return freeze({
        code: 'WAIT_FOR_RECAP',
        availableAt: earliest.availableAt,
        explanation: `The earliest known cycle availability is a recap at ${earliest.availableAt}; a 34-hour restart is not selected when this recap returns sooner.`,
      });
    }
    return freeze({
      code: 'COMPLETE_PLANNED_THIRTY_FOUR_HOUR_RESTART',
      availableAt: earliest.availableAt,
      explanation: `The explicitly planned 34-hour restart is the earliest known cycle restoration at ${earliest.availableAt}.`,
    });
  }
  if (restartPlanned) {
    const remaining = Math.max(
      0,
      STANDARD_PROPERTY_CARRYING_CYCLE_RULES.restartDurationMinutes
        - trailingRestMinutes,
    );
    return freeze({
      code: 'START_OR_CONTINUE_PLANNED_THIRTY_FOUR_HOUR_RESTART',
      minimumAdditionalRest: duration(remaining),
      explanation: `No exact recap or completed restart is present in the supplied timeline. Maintain an uninterrupted off-duty or sleeper-berth period for ${String(remaining)} additional minute(s) to complete the explicitly planned restart.`,
    });
  }
  return freeze({
    code: 'NO_KNOWN_CYCLE_AVAILABILITY',
    explanation: 'Cycle time is exhausted, no future recap exists in the supplied history, and no 34-hour restart was explicitly selected.',
  });
}

export function calculateHosCycle(
  input: HosCycleCalculationInput,
): HosCycleCalculationResult {
  const departureState = validateDriverHosDepartureState(input.departureState);
  const boundary = parseBoundary(input.regulatoryDayBoundary);
  const historicalDutyEvents = validateDutyEventHistory(
    input.historicalDutyEvents,
    { expectedEndAt: departureState.departureAt },
  );
  const dutyEvents = input.dutyEvents.length === 0
    ? freeze([] as DutyEvent[])
    : validateDutyEventHistory(input.dutyEvents, {
      expectedStartAt: departureState.departureAt,
    });
  const cycleRule = STANDARD_PROPERTY_CARRYING_CYCLE_RULES.limits[
    departureState.cycleType
  ];
  const currentRegulatoryDate = regulatoryDateAt(
    departureState.departureAt,
    boundary,
  );
  const firstWindowDate = currentRegulatoryDate.subtract({
    days: cycleRule.consecutiveRegulatoryDays - 1,
  });
  const windowStart = resolveBoundary(firstWindowDate, boundary).at;
  validateHistoryCoverage(
    historicalDutyEvents,
    windowStart,
    departureState.departureAt,
  );
  const selectedHistoricalRestart = validateSelectedRestart(
    input.selectedHistoricalRestart,
    historicalDutyEvents,
    departureState.departureAt,
  );
  const effectiveHistoryStart = selectedHistoricalRestart === undefined
    ? windowStart
    : maxInstant(windowStart, selectedHistoricalRestart.completedAt);

  const historicalBuckets = new Map<string, MutableDayBucket>();
  addEventMinutesToBuckets(
    historicalBuckets,
    historicalDutyEvents,
    boundary,
    effectiveHistoryStart,
    departureState.departureAt,
  );
  const regulatoryWindow = completeWindowDays(
    currentRegulatoryDate,
    cycleRule.consecutiveRegulatoryDays,
    boundary,
    historicalBuckets,
  );
  const historicalConsumption = regulatoryWindow.reduce(
    (total, day) => total + day.onDutyTime.value,
    0,
  );
  const derivedRemaining = Math.max(
    0,
    cycleRule.cycleMinutes - historicalConsumption,
  );
  const cycleReconciliation = reconcileCycle(
    departureState.cycleTimeRemaining.value,
    derivedRemaining,
  );

  const allBuckets = new Map<string, MutableDayBucket>();
  addEventMinutesToBuckets(
    allBuckets,
    historicalDutyEvents,
    boundary,
    effectiveHistoryStart,
    departureState.departureAt,
  );
  addEventMinutesToBuckets(allBuckets, dutyEvents, boundary);
  const recaps = recapSeeds(
    allBuckets,
    cycleRule.consecutiveRegulatoryDays,
    boundary,
    departureState.departureAt,
  );
  const recapReconciliation = reconcileRecaps(
    departureState.recapReturns,
    recaps.filter((seed) =>
      seed.sourceDayEndAt !== undefined
      && compareInstants(seed.sourceDayEndAt, departureState.departureAt) <= 0),
  );
  const restartSeed = plannedRestartSeed(
    departureState,
    historicalDutyEvents,
    dutyEvents,
  );
  const availabilitySeeds = restartSeed === undefined
    ? recaps
    : freeze([...recaps, restartSeed]);
  const simulation = simulate(
    departureState.departureAt,
    derivedRemaining,
    cycleRule.cycleMinutes,
    dutyEvents,
    availabilitySeeds,
  );
  const finalAt = dutyEvents.at(-1)?.endAt ?? departureState.departureAt;
  const trailingRest = trailingRestartMinutes(
    historicalDutyEvents,
    dutyEvents,
    finalAt,
  );
  const nextAvailability = nextCycleAvailability(
    simulation.final,
    simulation.availabilityEvents,
    departureState.restart34HourPlanned,
    trailingRest,
  );
  const reasons = freeze([
    `The ${departureState.cycleType} limit was calculated from timestamped on-duty events across carrier-designated regulatory days in ${boundary.timeZone}.`,
    'The entered cycle clock and entered recap list were preserved as evidence and reconciled rather than silently overwritten.',
    'Recap events were derived at the configured home-terminal boundary, including explicit repeated-time and nonexistent-time resolution.',
    departureState.restart34HourPlanned
      ? 'A future 34-hour restart was applied only if the supplied event timeline actually completed the explicitly planned qualifying period.'
      : 'No future 34-hour restart was applied because the departure state did not explicitly plan one.',
    selectedHistoricalRestart === undefined
      ? 'No historical 34-hour restart was assumed.'
      : `The explicitly selected historical restart completed at ${selectedHistoricalRestart.completedAt}.`,
    'This module owns rolling cycle arithmetic only; the Stage 05 core remains the authority for the 11-hour, 14-hour, 30-minute interruption, and 10-hour reset calculations.',
  ]);

  return freeze({
    ruleSet: STANDARD_PROPERTY_CARRYING_CYCLE_RULES,
    regulatoryDayBoundary: boundary,
    regulatoryWindow,
    ...(selectedHistoricalRestart === undefined
      ? {}
      : { selectedHistoricalRestart }),
    cycleReconciliation,
    recapReconciliation,
    initial: simulation.initial,
    transitions: simulation.transitions,
    final: simulation.final,
    availabilityEvents: simulation.availabilityEvents,
    violations: simulation.violations,
    nextCycleAvailability: nextAvailability,
    reasons,
  });
}
