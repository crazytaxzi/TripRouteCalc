import { ianaTimeZone, utcInstant } from './time.js';
import type { IanaTimeZone, UtcInstant } from './time.js';
import { duration } from './units.js';
import type { Duration } from './units.js';

export const DUTY_STATUSES = [
  'OFF_DUTY',
  'SLEEPER_BERTH',
  'DRIVING',
  'ON_DUTY_NOT_DRIVING',
] as const;
export type HosDutyStatus = (typeof DUTY_STATUSES)[number];

export const HOS_CYCLE_TYPES = [
  'SIXTY_HOURS_SEVEN_DAYS',
  'SEVENTY_HOURS_EIGHT_DAYS',
] as const;
export type HosCycleType = (typeof HOS_CYCLE_TYPES)[number];

export const HOS_DATA_ORIGINS = [
  'USER_ENTERED',
  'PROVIDER_DERIVED',
  'CALCULATED',
] as const;
export type HosDataOrigin = (typeof HOS_DATA_ORIGINS)[number];

export const HOS_VERIFICATION_STATES = ['UNVERIFIED', 'VERIFIED'] as const;
export type HosVerificationState = (typeof HOS_VERIFICATION_STATES)[number];

export const DUTY_EVENT_TYPES = [
  'STATUS_CHANGE',
  'PRE_TRIP_INSPECTION',
  'POST_TRIP_INSPECTION',
  'FUEL',
  'SCALE',
  'LOADING',
  'UNLOADING',
  'PAPERWORK',
  'BREAK',
  'REST',
  'MAINTENANCE',
  'BORDER_OR_AGRICULTURAL_INSPECTION',
  'OTHER',
] as const;
export type DutyEventType = (typeof DUTY_EVENT_TYPES)[number];

export const DUTY_EVENT_SOURCES = [
  'USER_ENTERED',
  'ELD_PROVIDER',
  'CARRIER_SYSTEM',
  'CALCULATED',
  'VERIFIED_RECORD',
] as const;
export type DutyEventSource = (typeof DUTY_EVENT_SOURCES)[number];

export type DrivingClockEffect = 'CONSUMES' | 'DOES_NOT_CONSUME';
export type ShiftClockEffect = 'ADVANCES_WINDOW' | 'RULE_DEPENDENT';
export type CycleClockEffect = 'CONSUMES' | 'DOES_NOT_CONSUME';
export type SleeperCandidateRole = 'SHORT_PERIOD' | 'LONG_PERIOD';

export interface HosDataProvenance {
  readonly origin: HosDataOrigin;
  readonly verification: HosVerificationState;
  readonly sourceName?: string;
  readonly verifiedAt?: UtcInstant;
  readonly explanation?: string;
}

export interface DriverReference {
  readonly id?: string;
  readonly nameOrIdentifier: string;
}

export interface PriorDutyDay {
  readonly date: string;
  readonly onDutyTime: Duration;
}

export interface CycleRecapReturn {
  readonly sourceDate: string;
  readonly availableAt: UtcInstant;
  readonly returnedTime: Duration;
}

export interface SleeperPeriodEvidence {
  readonly id: string;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly duration: Duration;
  readonly candidateRole: SleeperCandidateRole;
  readonly pairId?: string;
  readonly source: DutyEventSource;
  readonly explanation: string;
}

export interface NightlyRestPreference {
  readonly startLocalTime: string;
  readonly endLocalTime: string;
  readonly timeZone: IanaTimeZone;
}

export interface DriverHosProvenance {
  readonly driver: HosDataProvenance;
  readonly departure: HosDataProvenance;
  readonly dutyStatus: HosDataProvenance;
  readonly clocks: HosDataProvenance;
  readonly dutyHistory: HosDataProvenance;
  readonly sleeper: HosDataProvenance;
  readonly carrierPolicy: HosDataProvenance;
  readonly restPreference: HosDataProvenance;
}

export interface DriverHosDepartureState {
  readonly driver: DriverReference;
  readonly departureAt: UtcInstant;
  readonly departureTimeZone: IanaTimeZone;
  readonly currentDutyStatus: HosDutyStatus;
  readonly currentDutyStatusStartedAt: UtcInstant;
  readonly drivingTimeRemaining: Duration;
  readonly shiftTimeRemaining: Duration;
  readonly cycleTimeRemaining: Duration;
  readonly cycleType: HosCycleType;
  readonly drivenSinceLastQualifyingInterruption: Duration;
  readonly onDutyTimeCurrentShift: Duration;
  readonly offDutyTimeImmediatelyBeforeDeparture: Duration;
  readonly qualifyingTenHourBreakCompleted: boolean;
  readonly priorDutyDays: readonly PriorDutyDay[];
  readonly recapReturns: readonly CycleRecapReturn[];
  readonly sleeperBerthEligible: boolean;
  readonly existingSleeperPeriods: readonly SleeperPeriodEvidence[];
  readonly splitSleeperEnabled: boolean;
  readonly restart34HourPlanned: boolean;
  readonly carrierMaxDailyDriving: Duration;
  readonly carrierMaxDuty: Duration;
  readonly nightlyRestPreference?: NightlyRestPreference;
  readonly provenance: DriverHosProvenance;
}

export interface DutyEventLocation {
  readonly description: string;
  readonly timeZone: IanaTimeZone;
}

export interface DutyEventClockEffects {
  readonly driving: DrivingClockEffect;
  readonly shift: ShiftClockEffect;
  readonly cycle: CycleClockEffect;
}

export interface SleeperPairParticipation {
  readonly participates: boolean;
  readonly pairId?: string;
  readonly candidateRole?: SleeperCandidateRole;
}

export interface DutyEvent {
  readonly id: string;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly duration: Duration;
  readonly dutyStatus: HosDutyStatus;
  readonly eventType: DutyEventType;
  readonly location: DutyEventLocation;
  readonly source: DutyEventSource;
  readonly explanation: string;
  readonly clockEffects: DutyEventClockEffects;
  readonly qualifiesForThirtyMinuteInterruption: boolean;
  readonly sleeperPair: SleeperPairParticipation;
  readonly provenance: HosDataProvenance;
}

export interface DutyEventHistoryValidationOptions {
  readonly expectedStartAt?: UtcInstant;
  readonly expectedEndAt?: UtcInstant;
  readonly allowGaps?: boolean;
}

export interface DriverHosDepartureApiModel {
  readonly driverId?: string;
  readonly driverNameOrIdentifier: string;
  readonly departureAt: string;
  readonly departureTimeZone: string;
  readonly currentDutyStatus: HosDutyStatus;
  readonly currentDutyStatusStartedAt: string;
  readonly drivingMinutesRemaining: number;
  readonly shiftMinutesRemaining: number;
  readonly cycleMinutesRemaining: number;
  readonly cycleType: HosCycleType;
  readonly drivenMinutesSinceLastQualifyingInterruption: number;
  readonly onDutyMinutesCurrentShift: number;
  readonly offDutyMinutesImmediatelyBeforeDeparture: number;
  readonly qualifyingTenHourBreakCompleted: boolean;
  readonly priorDutyDays: readonly {
    readonly date: string;
    readonly onDutyMinutes: number;
  }[];
  readonly recapReturns: readonly {
    readonly sourceDate: string;
    readonly availableAt: string;
    readonly returnedMinutes: number;
  }[];
  readonly sleeperBerthEligible: boolean;
  readonly existingSleeperPeriods: readonly {
    readonly id: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly durationMinutes: number;
    readonly candidateRole: SleeperCandidateRole;
    readonly pairId?: string;
    readonly source: DutyEventSource;
    readonly explanation: string;
  }[];
  readonly splitSleeperEnabled: boolean;
  readonly restart34HourPlanned: boolean;
  readonly carrierMaxDailyDrivingMinutes: number;
  readonly carrierMaxDutyMinutes: number;
  readonly nightlyRestPreference?: {
    readonly startLocalTime: string;
    readonly endLocalTime: string;
    readonly timeZone: string;
  };
  readonly provenance: DriverHosProvenance;
}

export type HosValidationIssueCode =
  | 'INVALID_TYPE'
  | 'MISSING_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_TIMESTAMP'
  | 'CLOCK_EXCEEDS_MAXIMUM'
  | 'CONTRADICTORY_STATE'
  | 'INVALID_PRIOR_DAY_HISTORY'
  | 'INVALID_RECAP_RETURN'
  | 'INVALID_SLEEPER_PERIOD'
  | 'EVENT_DURATION_MISMATCH'
  | 'EVENT_ORDER'
  | 'EVENT_OVERLAP'
  | 'EVENT_GAP'
  | 'EVENT_CLOCK_EFFECT_MISMATCH';

export interface HosValidationIssue {
  readonly code: HosValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class HosValidationError extends Error {
  public override readonly name = 'HosValidationError';

  public constructor(public readonly issues: readonly HosValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
}

const LEGAL_DRIVING_MINUTES = 11 * 60;
const LEGAL_SHIFT_MINUTES = 14 * 60;
const CYCLE_MINUTES: Readonly<Record<HosCycleType, number>> = Object.freeze({
  SIXTY_HOURS_SEVEN_DAYS: 60 * 60,
  SEVENTY_HOURS_EIGHT_DAYS: 70 * 60,
});
const PRIOR_DAY_COUNT: Readonly<Record<HosCycleType, number>> = Object.freeze({
  SIXTY_HOURS_SEVEN_DAYS: 7,
  SEVENTY_HOURS_EIGHT_DAYS: 8,
});
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function asRecord(value: unknown, path: string, issues: HosValidationIssue[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({ code: 'INVALID_TYPE', path, message: 'Expected an object.' });
    return {};
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string, path: string, issues: HosValidationIssue[]): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({ code: value === undefined ? 'MISSING_FIELD' : 'INVALID_VALUE', path: `${path}.${key}`, message: 'Expected a non-empty string.' });
    return '';
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, path: string, issues: HosValidationIssue[]): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({ code: 'INVALID_VALUE', path: `${path}.${key}`, message: 'Expected a non-empty string when provided.' });
    return undefined;
  }
  return value;
}

function requiredBoolean(record: Record<string, unknown>, key: string, path: string, issues: HosValidationIssue[]): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    issues.push({ code: value === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE', path: `${path}.${key}`, message: 'Expected a boolean.' });
    return false;
  }
  return value;
}

function enumValue<T extends readonly string[]>(record: Record<string, unknown>, key: string, values: T, path: string, issues: HosValidationIssue[]): T[number] {
  const value = record[key];
  if (typeof value !== 'string' || !values.includes(value)) {
    issues.push({ code: value === undefined ? 'MISSING_FIELD' : 'INVALID_VALUE', path: `${path}.${key}`, message: `Expected one of: ${values.join(', ')}.` });
    return values[0] as T[number];
  }
  return value;
}

function parseDuration(value: unknown, path: string, issues: HosValidationIssue[]): Duration {
  try {
    return duration(value);
  } catch {
    issues.push({ code: 'INVALID_VALUE', path, message: 'Expected a non-negative, whole-minute duration object.' });
    return freeze({ value: 0, unit: 'minute' as const });
  }
}

function parseInstant(value: unknown, path: string, issues: HosValidationIssue[]): UtcInstant {
  try {
    return utcInstant(value);
  } catch {
    issues.push({ code: 'INVALID_TIMESTAMP', path, message: 'Expected a valid timestamp with an explicit offset.' });
    return '1970-01-01T00:00:00.000Z' as UtcInstant;
  }
}

function parseTimeZone(value: unknown, path: string, issues: HosValidationIssue[]): IanaTimeZone {
  try {
    return ianaTimeZone(value);
  } catch {
    issues.push({ code: 'INVALID_TIME_ZONE', path, message: 'Expected a valid IANA time-zone identifier.' });
    return 'UTC' as IanaTimeZone;
  }
}

function parseProvenance(value: unknown, path: string, issues: HosValidationIssue[]): HosDataProvenance {
  const record = asRecord(value, path, issues);
  const origin = enumValue(record, 'origin', HOS_DATA_ORIGINS, path, issues);
  const verification = enumValue(record, 'verification', HOS_VERIFICATION_STATES, path, issues);
  const sourceName = optionalString(record, 'sourceName', path, issues);
  const explanation = optionalString(record, 'explanation', path, issues);
  const verifiedAt = record.verifiedAt === undefined ? undefined : parseInstant(record.verifiedAt, `${path}.verifiedAt`, issues);

  if (verification === 'VERIFIED' && verifiedAt === undefined) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: `${path}.verifiedAt`, message: 'Verified data requires a verification timestamp.' });
  }

  return freeze({
    origin,
    verification,
    ...(sourceName === undefined ? {} : { sourceName }),
    ...(verifiedAt === undefined ? {} : { verifiedAt }),
    ...(explanation === undefined ? {} : { explanation }),
  });
}

function parseDriverHosProvenance(value: unknown, path: string, issues: HosValidationIssue[]): DriverHosProvenance {
  const record = asRecord(value, path, issues);
  return freeze({
    driver: parseProvenance(record.driver, `${path}.driver`, issues),
    departure: parseProvenance(record.departure, `${path}.departure`, issues),
    dutyStatus: parseProvenance(record.dutyStatus, `${path}.dutyStatus`, issues),
    clocks: parseProvenance(record.clocks, `${path}.clocks`, issues),
    dutyHistory: parseProvenance(record.dutyHistory, `${path}.dutyHistory`, issues),
    sleeper: parseProvenance(record.sleeper, `${path}.sleeper`, issues),
    carrierPolicy: parseProvenance(record.carrierPolicy, `${path}.carrierPolicy`, issues),
    restPreference: parseProvenance(record.restPreference, `${path}.restPreference`, issues),
  });
}

function timestamp(value: UtcInstant): number {
  return Date.parse(value);
}

function exactDurationMinutes(startAt: UtcInstant, endAt: UtcInstant): number | undefined {
  const milliseconds = timestamp(endAt) - timestamp(startAt);
  if (milliseconds <= 0 || milliseconds % 60_000 !== 0) return undefined;
  return milliseconds / 60_000;
}

function localDateAt(instant: UtcInstant, timeZone: IanaTimeZone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function parsePriorDutyDay(value: unknown, path: string, issues: HosValidationIssue[]): PriorDutyDay {
  const record = asRecord(value, path, issues);
  const dateValue = requiredString(record, 'date', path, issues);
  if (!LOCAL_DATE_PATTERN.test(dateValue) || Number.isNaN(Date.parse(`${dateValue}T00:00:00.000Z`))) {
    issues.push({ code: 'INVALID_PRIOR_DAY_HISTORY', path: `${path}.date`, message: 'Expected a valid YYYY-MM-DD date.' });
  }
  return freeze({
    date: dateValue,
    onDutyTime: parseDuration(record.onDutyTime, `${path}.onDutyTime`, issues),
  });
}

function parseRecapReturn(value: unknown, path: string, issues: HosValidationIssue[]): CycleRecapReturn {
  const record = asRecord(value, path, issues);
  const sourceDate = requiredString(record, 'sourceDate', path, issues);
  if (!LOCAL_DATE_PATTERN.test(sourceDate) || Number.isNaN(Date.parse(`${sourceDate}T00:00:00.000Z`))) {
    issues.push({ code: 'INVALID_RECAP_RETURN', path: `${path}.sourceDate`, message: 'Expected a valid YYYY-MM-DD source date.' });
  }
  return freeze({
    sourceDate,
    availableAt: parseInstant(record.availableAt, `${path}.availableAt`, issues),
    returnedTime: parseDuration(record.returnedTime, `${path}.returnedTime`, issues),
  });
}

function parseSleeperPeriod(value: unknown, path: string, issues: HosValidationIssue[]): SleeperPeriodEvidence {
  const record = asRecord(value, path, issues);
  const startAt = parseInstant(record.startAt, `${path}.startAt`, issues);
  const endAt = parseInstant(record.endAt, `${path}.endAt`, issues);
  const parsedDuration = parseDuration(record.duration, `${path}.duration`, issues);
  const candidateRole = enumValue(record, 'candidateRole', ['SHORT_PERIOD', 'LONG_PERIOD'] as const, path, issues);
  const pairId = optionalString(record, 'pairId', path, issues);
  const actualMinutes = exactDurationMinutes(startAt, endAt);
  if (actualMinutes === undefined || actualMinutes !== parsedDuration.value) {
    issues.push({ code: 'INVALID_SLEEPER_PERIOD', path, message: 'Sleeper period timestamps must move forward by the stated whole-minute duration.' });
  }
  const minimum = candidateRole === 'LONG_PERIOD' ? 7 * 60 : 2 * 60;
  if (parsedDuration.value < minimum) {
    issues.push({ code: 'INVALID_SLEEPER_PERIOD', path: `${path}.duration`, message: `${candidateRole} requires at least ${String(minimum)} minutes.` });
  }
  return freeze({
    id: requiredString(record, 'id', path, issues),
    startAt,
    endAt,
    duration: parsedDuration,
    candidateRole,
    ...(pairId === undefined ? {} : { pairId }),
    source: enumValue(record, 'source', DUTY_EVENT_SOURCES, path, issues),
    explanation: requiredString(record, 'explanation', path, issues),
  });
}

function parseNightlyRestPreference(value: unknown, path: string, issues: HosValidationIssue[]): NightlyRestPreference {
  const record = asRecord(value, path, issues);
  const startLocalTime = requiredString(record, 'startLocalTime', path, issues);
  const endLocalTime = requiredString(record, 'endLocalTime', path, issues);
  if (!LOCAL_TIME_PATTERN.test(startLocalTime)) {
    issues.push({ code: 'INVALID_VALUE', path: `${path}.startLocalTime`, message: 'Expected HH:mm in 24-hour local time.' });
  }
  if (!LOCAL_TIME_PATTERN.test(endLocalTime)) {
    issues.push({ code: 'INVALID_VALUE', path: `${path}.endLocalTime`, message: 'Expected HH:mm in 24-hour local time.' });
  }
  if (startLocalTime === endLocalTime) {
    issues.push({ code: 'CONTRADICTORY_STATE', path, message: 'Nightly rest start and end times must differ.' });
  }
  return freeze({ startLocalTime, endLocalTime, timeZone: parseTimeZone(record.timeZone, `${path}.timeZone`, issues) });
}

export function validateDriverHosDepartureState(input: unknown): DriverHosDepartureState {
  const issues: HosValidationIssue[] = [];
  const record = asRecord(input, 'departureState', issues);
  const driverRecord = asRecord(record.driver, 'departureState.driver', issues);
  const driverId = optionalString(driverRecord, 'id', 'departureState.driver', issues);
  const driver = freeze({
    ...(driverId === undefined ? {} : { id: driverId }),
    nameOrIdentifier: requiredString(driverRecord, 'nameOrIdentifier', 'departureState.driver', issues),
  });
  const departureAt = parseInstant(record.departureAt, 'departureState.departureAt', issues);
  const departureTimeZone = parseTimeZone(record.departureTimeZone, 'departureState.departureTimeZone', issues);
  const currentDutyStatus = enumValue(record, 'currentDutyStatus', DUTY_STATUSES, 'departureState', issues);
  const currentDutyStatusStartedAt = parseInstant(record.currentDutyStatusStartedAt, 'departureState.currentDutyStatusStartedAt', issues);
  const drivingTimeRemaining = parseDuration(record.drivingTimeRemaining, 'departureState.drivingTimeRemaining', issues);
  const shiftTimeRemaining = parseDuration(record.shiftTimeRemaining, 'departureState.shiftTimeRemaining', issues);
  const cycleTimeRemaining = parseDuration(record.cycleTimeRemaining, 'departureState.cycleTimeRemaining', issues);
  const cycleType = enumValue(record, 'cycleType', HOS_CYCLE_TYPES, 'departureState', issues);
  const drivenSinceLastQualifyingInterruption = parseDuration(record.drivenSinceLastQualifyingInterruption, 'departureState.drivenSinceLastQualifyingInterruption', issues);
  const onDutyTimeCurrentShift = parseDuration(record.onDutyTimeCurrentShift, 'departureState.onDutyTimeCurrentShift', issues);
  const offDutyTimeImmediatelyBeforeDeparture = parseDuration(record.offDutyTimeImmediatelyBeforeDeparture, 'departureState.offDutyTimeImmediatelyBeforeDeparture', issues);
  const qualifyingTenHourBreakCompleted = requiredBoolean(record, 'qualifyingTenHourBreakCompleted', 'departureState', issues);
  const sleeperBerthEligible = requiredBoolean(record, 'sleeperBerthEligible', 'departureState', issues);
  const splitSleeperEnabled = requiredBoolean(record, 'splitSleeperEnabled', 'departureState', issues);
  const restart34HourPlanned = requiredBoolean(record, 'restart34HourPlanned', 'departureState', issues);
  const carrierMaxDailyDriving = parseDuration(record.carrierMaxDailyDriving, 'departureState.carrierMaxDailyDriving', issues);
  const carrierMaxDuty = parseDuration(record.carrierMaxDuty, 'departureState.carrierMaxDuty', issues);

  if (timestamp(currentDutyStatusStartedAt) > timestamp(departureAt)) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: 'departureState.currentDutyStatusStartedAt', message: 'Current duty status cannot begin after departure.' });
  }
  if (drivingTimeRemaining.value > LEGAL_DRIVING_MINUTES) {
    issues.push({ code: 'CLOCK_EXCEEDS_MAXIMUM', path: 'departureState.drivingTimeRemaining', message: 'Driving time remaining cannot exceed 660 minutes.' });
  }
  if (shiftTimeRemaining.value > LEGAL_SHIFT_MINUTES) {
    issues.push({ code: 'CLOCK_EXCEEDS_MAXIMUM', path: 'departureState.shiftTimeRemaining', message: 'Shift time remaining cannot exceed 840 minutes.' });
  }
  if (cycleTimeRemaining.value > CYCLE_MINUTES[cycleType]) {
    issues.push({ code: 'CLOCK_EXCEEDS_MAXIMUM', path: 'departureState.cycleTimeRemaining', message: `Cycle time remaining cannot exceed ${String(CYCLE_MINUTES[cycleType])} minutes for ${cycleType}.` });
  }
  if (drivenSinceLastQualifyingInterruption.value > LEGAL_DRIVING_MINUTES) {
    issues.push({ code: 'CLOCK_EXCEEDS_MAXIMUM', path: 'departureState.drivenSinceLastQualifyingInterruption', message: 'Driven time since the last qualifying interruption cannot exceed the 11-hour driving maximum.' });
  }
  if (onDutyTimeCurrentShift.value > LEGAL_SHIFT_MINUTES) {
    issues.push({ code: 'CLOCK_EXCEEDS_MAXIMUM', path: 'departureState.onDutyTimeCurrentShift', message: 'Current-shift on-duty time cannot exceed 840 minutes in this standard-rule departure model.' });
  }
  if (carrierMaxDailyDriving.value <= 0 || carrierMaxDailyDriving.value > LEGAL_DRIVING_MINUTES) {
    issues.push({ code: 'INVALID_VALUE', path: 'departureState.carrierMaxDailyDriving', message: 'Carrier daily driving target must be between 1 and 660 minutes.' });
  }
  if (carrierMaxDuty.value <= 0 || carrierMaxDuty.value > LEGAL_SHIFT_MINUTES) {
    issues.push({ code: 'INVALID_VALUE', path: 'departureState.carrierMaxDuty', message: 'Carrier duty target must be between 1 and 840 minutes.' });
  }
  if (qualifyingTenHourBreakCompleted && offDutyTimeImmediatelyBeforeDeparture.value < 10 * 60) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: 'departureState.qualifyingTenHourBreakCompleted', message: 'A claimed qualifying 10-hour break requires at least 600 immediately preceding off-duty minutes.' });
  }
  if (splitSleeperEnabled && !sleeperBerthEligible) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: 'departureState.splitSleeperEnabled', message: 'Split sleeper cannot be enabled when the driver is not sleeper-berth eligible.' });
  }

  if (currentDutyStatus === 'OFF_DUTY' || currentDutyStatus === 'SLEEPER_BERTH') {
    const currentStatusMinutes = exactDurationMinutes(currentDutyStatusStartedAt, departureAt);
    if (currentStatusMinutes !== undefined && offDutyTimeImmediatelyBeforeDeparture.value < currentStatusMinutes) {
      issues.push({ code: 'CONTRADICTORY_STATE', path: 'departureState.offDutyTimeImmediatelyBeforeDeparture', message: 'Immediately preceding off-duty time cannot be shorter than the current off-duty or sleeper status duration.' });
    }
  }

  const priorDayInput = record.priorDutyDays;
  const priorDutyDays = Array.isArray(priorDayInput)
    ? priorDayInput.map((value, index) => parsePriorDutyDay(value, `departureState.priorDutyDays[${String(index)}]`, issues))
    : [];
  if (!Array.isArray(priorDayInput)) {
    issues.push({ code: priorDayInput === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE', path: 'departureState.priorDutyDays', message: 'Expected an array.' });
  }
  const requiredPriorDays = PRIOR_DAY_COUNT[cycleType];
  if (priorDutyDays.length !== requiredPriorDays) {
    issues.push({ code: 'INVALID_PRIOR_DAY_HISTORY', path: 'departureState.priorDutyDays', message: `${cycleType} requires exactly ${String(requiredPriorDays)} prior daily totals.` });
  }
  const departureLocalDate = localDateAt(departureAt, departureTimeZone);
  priorDutyDays.forEach((day, index) => {
    const expectedDate = addDays(departureLocalDate, index - requiredPriorDays);
    if (day.date !== expectedDate) {
      issues.push({ code: 'INVALID_PRIOR_DAY_HISTORY', path: `departureState.priorDutyDays[${String(index)}].date`, message: `Expected ${expectedDate} for an ordered, consecutive prior-day history.` });
    }
    if (day.onDutyTime.value > 24 * 60) {
      issues.push({ code: 'INVALID_PRIOR_DAY_HISTORY', path: `departureState.priorDutyDays[${String(index)}].onDutyTime`, message: 'A daily total cannot exceed 1,440 minutes.' });
    }
  });

  const recapInput = record.recapReturns;
  const recapReturns = Array.isArray(recapInput)
    ? recapInput.map((value, index) => parseRecapReturn(value, `departureState.recapReturns[${String(index)}]`, issues))
    : [];
  if (!Array.isArray(recapInput)) {
    issues.push({ code: recapInput === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE', path: 'departureState.recapReturns', message: 'Expected an array.' });
  }
  recapReturns.forEach((recap, index) => {
    if (timestamp(recap.availableAt) < timestamp(departureAt)) {
      issues.push({ code: 'INVALID_RECAP_RETURN', path: `departureState.recapReturns[${String(index)}].availableAt`, message: 'Expected recap returns must become available at or after departure.' });
    }
    if (recap.returnedTime.value <= 0) {
      issues.push({ code: 'INVALID_RECAP_RETURN', path: `departureState.recapReturns[${String(index)}].returnedTime`, message: 'A recap return must add at least one minute.' });
    }
    const previous = recapReturns[index - 1];
    if (previous !== undefined && timestamp(recap.availableAt) < timestamp(previous.availableAt)) {
      issues.push({ code: 'INVALID_RECAP_RETURN', path: `departureState.recapReturns[${String(index)}].availableAt`, message: 'Recap returns must be ordered by availability.' });
    }
  });

  const sleeperInput = record.existingSleeperPeriods;
  const existingSleeperPeriods = Array.isArray(sleeperInput)
    ? sleeperInput.map((value, index) => parseSleeperPeriod(value, `departureState.existingSleeperPeriods[${String(index)}]`, issues))
    : [];
  if (!Array.isArray(sleeperInput)) {
    issues.push({ code: sleeperInput === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE', path: 'departureState.existingSleeperPeriods', message: 'Expected an array.' });
  }
  existingSleeperPeriods.forEach((period, index) => {
    if (timestamp(period.endAt) > timestamp(departureAt)) {
      issues.push({ code: 'INVALID_SLEEPER_PERIOD', path: `departureState.existingSleeperPeriods[${String(index)}].endAt`, message: 'Existing sleeper evidence cannot end after departure.' });
    }
    const previous = existingSleeperPeriods[index - 1];
    if (previous !== undefined && timestamp(period.startAt) < timestamp(previous.endAt)) {
      issues.push({ code: 'INVALID_SLEEPER_PERIOD', path: `departureState.existingSleeperPeriods[${String(index)}]`, message: 'Existing sleeper periods must be ordered and non-overlapping.' });
    }
  });

  const nightlyRestPreference = record.nightlyRestPreference === undefined
    ? undefined
    : parseNightlyRestPreference(record.nightlyRestPreference, 'departureState.nightlyRestPreference', issues);
  const provenance = parseDriverHosProvenance(record.provenance, 'departureState.provenance', issues);

  if (issues.length > 0) throw new HosValidationError(freeze(issues));

  return freeze({
    driver,
    departureAt,
    departureTimeZone,
    currentDutyStatus,
    currentDutyStatusStartedAt,
    drivingTimeRemaining,
    shiftTimeRemaining,
    cycleTimeRemaining,
    cycleType,
    drivenSinceLastQualifyingInterruption,
    onDutyTimeCurrentShift,
    offDutyTimeImmediatelyBeforeDeparture,
    qualifyingTenHourBreakCompleted,
    priorDutyDays: freeze(priorDutyDays),
    recapReturns: freeze(recapReturns),
    sleeperBerthEligible,
    existingSleeperPeriods: freeze(existingSleeperPeriods),
    splitSleeperEnabled,
    restart34HourPlanned,
    carrierMaxDailyDriving,
    carrierMaxDuty,
    ...(nightlyRestPreference === undefined ? {} : { nightlyRestPreference }),
    provenance,
  });
}

function expectedClockEffects(status: HosDutyStatus): DutyEventClockEffects {
  switch (status) {
    case 'DRIVING':
      return freeze({ driving: 'CONSUMES', shift: 'ADVANCES_WINDOW', cycle: 'CONSUMES' });
    case 'ON_DUTY_NOT_DRIVING':
      return freeze({ driving: 'DOES_NOT_CONSUME', shift: 'ADVANCES_WINDOW', cycle: 'CONSUMES' });
    case 'OFF_DUTY':
      return freeze({ driving: 'DOES_NOT_CONSUME', shift: 'ADVANCES_WINDOW', cycle: 'DOES_NOT_CONSUME' });
    case 'SLEEPER_BERTH':
      return freeze({ driving: 'DOES_NOT_CONSUME', shift: 'RULE_DEPENDENT', cycle: 'DOES_NOT_CONSUME' });
  }
}

function parseDutyEventClockEffects(value: unknown, path: string, issues: HosValidationIssue[]): DutyEventClockEffects {
  const record = asRecord(value, path, issues);
  return freeze({
    driving: enumValue(record, 'driving', ['CONSUMES', 'DOES_NOT_CONSUME'] as const, path, issues),
    shift: enumValue(record, 'shift', ['ADVANCES_WINDOW', 'RULE_DEPENDENT'] as const, path, issues),
    cycle: enumValue(record, 'cycle', ['CONSUMES', 'DOES_NOT_CONSUME'] as const, path, issues),
  });
}

function parseSleeperPair(value: unknown, path: string, issues: HosValidationIssue[]): SleeperPairParticipation {
  const record = asRecord(value, path, issues);
  const participates = requiredBoolean(record, 'participates', path, issues);
  const pairId = optionalString(record, 'pairId', path, issues);
  const candidateRole = record.candidateRole === undefined
    ? undefined
    : enumValue(record, 'candidateRole', ['SHORT_PERIOD', 'LONG_PERIOD'] as const, path, issues);
  if (participates && (pairId === undefined || candidateRole === undefined)) {
    issues.push({ code: 'CONTRADICTORY_STATE', path, message: 'Sleeper-pair participation requires both pairId and candidateRole.' });
  }
  if (!participates && (pairId !== undefined || candidateRole !== undefined)) {
    issues.push({ code: 'CONTRADICTORY_STATE', path, message: 'Non-participating events cannot carry sleeper-pair identifiers.' });
  }
  return freeze({
    participates,
    ...(pairId === undefined ? {} : { pairId }),
    ...(candidateRole === undefined ? {} : { candidateRole }),
  });
}

export function validateDutyEvent(input: unknown, path = 'dutyEvent'): DutyEvent {
  const issues: HosValidationIssue[] = [];
  const record = asRecord(input, path, issues);
  const startAt = parseInstant(record.startAt, `${path}.startAt`, issues);
  const endAt = parseInstant(record.endAt, `${path}.endAt`, issues);
  const parsedDuration = parseDuration(record.duration, `${path}.duration`, issues);
  const dutyStatus = enumValue(record, 'dutyStatus', DUTY_STATUSES, path, issues);
  const clockEffects = parseDutyEventClockEffects(record.clockEffects, `${path}.clockEffects`, issues);
  const qualifiesForThirtyMinuteInterruption = requiredBoolean(record, 'qualifiesForThirtyMinuteInterruption', path, issues);
  const sleeperPair = parseSleeperPair(record.sleeperPair, `${path}.sleeperPair`, issues);
  const locationRecord = asRecord(record.location, `${path}.location`, issues);
  const actualMinutes = exactDurationMinutes(startAt, endAt);
  if (actualMinutes === undefined || actualMinutes !== parsedDuration.value) {
    issues.push({ code: 'EVENT_DURATION_MISMATCH', path: `${path}.duration`, message: 'Event timestamps must move forward by the stated whole-minute duration.' });
  }
  if (parsedDuration.value <= 0) {
    issues.push({ code: 'INVALID_VALUE', path: `${path}.duration`, message: 'Duty events must last at least one minute.' });
  }

  const expected = expectedClockEffects(dutyStatus);
  if (clockEffects.driving !== expected.driving || clockEffects.cycle !== expected.cycle) {
    issues.push({ code: 'EVENT_CLOCK_EFFECT_MISMATCH', path: `${path}.clockEffects`, message: `${dutyStatus} has incompatible driving or cycle clock effects.` });
  }
  if (dutyStatus === 'DRIVING' || dutyStatus === 'ON_DUTY_NOT_DRIVING') {
    if (clockEffects.shift !== 'ADVANCES_WINDOW') {
      issues.push({ code: 'EVENT_CLOCK_EFFECT_MISMATCH', path: `${path}.clockEffects.shift`, message: `${dutyStatus} must advance the 14-hour window.` });
    }
  } else if (dutyStatus === 'SLEEPER_BERTH' && !['RULE_DEPENDENT', 'ADVANCES_WINDOW'].includes(clockEffects.shift)) {
    issues.push({ code: 'EVENT_CLOCK_EFFECT_MISMATCH', path: `${path}.clockEffects.shift`, message: 'Sleeper-berth shift effect must remain rule-dependent or explicitly advance the window.' });
  }
  if (qualifiesForThirtyMinuteInterruption && parsedDuration.value < 30) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: `${path}.qualifiesForThirtyMinuteInterruption`, message: 'A qualifying interruption requires at least 30 consecutive minutes.' });
  }
  if (dutyStatus === 'DRIVING' && qualifiesForThirtyMinuteInterruption) {
    issues.push({ code: 'CONTRADICTORY_STATE', path: `${path}.qualifiesForThirtyMinuteInterruption`, message: 'Driving cannot satisfy the non-driving interruption.' });
  }
  if (sleeperPair.participates && dutyStatus !== 'SLEEPER_BERTH') {
    issues.push({ code: 'CONTRADICTORY_STATE', path: `${path}.sleeperPair`, message: 'Only sleeper-berth events may participate in a sleeper pairing.' });
  }
  if (sleeperPair.participates) {
    const candidateRole = sleeperPair.candidateRole ?? 'SHORT_PERIOD';
    const minimum = candidateRole === 'LONG_PERIOD' ? 7 * 60 : 2 * 60;
    if (parsedDuration.value < minimum) {
      issues.push({ code: 'CONTRADICTORY_STATE', path: `${path}.sleeperPair.candidateRole`, message: `${candidateRole} requires at least ${String(minimum)} minutes.` });
    }
  }

  const id = requiredString(record, 'id', path, issues);
  const eventType = enumValue(record, 'eventType', DUTY_EVENT_TYPES, path, issues);
  const location = freeze({
    description: requiredString(locationRecord, 'description', `${path}.location`, issues),
    timeZone: parseTimeZone(locationRecord.timeZone, `${path}.location.timeZone`, issues),
  });
  const source = enumValue(record, 'source', DUTY_EVENT_SOURCES, path, issues);
  const explanation = requiredString(record, 'explanation', path, issues);
  const provenance = parseProvenance(record.provenance, `${path}.provenance`, issues);

  if (issues.length > 0) throw new HosValidationError(freeze(issues));
  return freeze({
    id,
    startAt,
    endAt,
    duration: parsedDuration,
    dutyStatus,
    eventType,
    location,
    source,
    explanation,
    clockEffects,
    qualifiesForThirtyMinuteInterruption,
    sleeperPair,
    provenance,
  });
}

export function validateDutyEventHistory(input: unknown, options: DutyEventHistoryValidationOptions = {}): readonly DutyEvent[] {
  const issues: HosValidationIssue[] = [];
  if (!Array.isArray(input)) {
    throw new HosValidationError([{ code: 'INVALID_TYPE', path: 'dutyEvents', message: 'Expected an array.' }]);
  }
  const events: DutyEvent[] = [];
  input.forEach((value, index) => {
    try {
      events.push(validateDutyEvent(value, `dutyEvents[${String(index)}]`));
    } catch (error) {
      if (error instanceof HosValidationError) issues.push(...error.issues);
      else throw error;
    }
  });
  events.forEach((event, index) => {
    if (index === 0) return;
    const previous = events[index - 1];
    if (previous === undefined) return;
    if (timestamp(event.startAt) < timestamp(previous.startAt)) {
      issues.push({ code: 'EVENT_ORDER', path: `dutyEvents[${String(index)}].startAt`, message: 'Duty events must already be ordered by start time; validation does not silently sort them.' });
    }
    if (timestamp(event.startAt) < timestamp(previous.endAt)) {
      issues.push({ code: 'EVENT_OVERLAP', path: `dutyEvents[${String(index)}].startAt`, message: 'Duty events cannot overlap.' });
    } else if (timestamp(event.startAt) > timestamp(previous.endAt) && options.allowGaps !== true) {
      issues.push({ code: 'EVENT_GAP', path: `dutyEvents[${String(index)}].startAt`, message: 'A complete duty-event history cannot contain unexplained gaps.' });
    }
  });
  if (options.expectedStartAt !== undefined && events[0]?.startAt !== utcInstant(options.expectedStartAt)) {
    issues.push({ code: 'EVENT_GAP', path: 'dutyEvents[0].startAt', message: 'Duty-event history does not begin at the expected boundary.' });
  }
  if (options.expectedEndAt !== undefined && events.at(-1)?.endAt !== utcInstant(options.expectedEndAt)) {
    issues.push({ code: 'EVENT_GAP', path: `dutyEvents[${String(Math.max(0, events.length - 1))}].endAt`, message: 'Duty-event history does not end at the expected boundary.' });
  }
  if (issues.length > 0) throw new HosValidationError(freeze(issues));
  return freeze(events);
}

export function driverHosDepartureStateFromApi(input: unknown): DriverHosDepartureState {
  const record = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const priorDutyDays = Array.isArray(record.priorDutyDays)
    ? record.priorDutyDays.map((value) => {
        const day = typeof value === 'object' && value !== null && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {};
        return {
          date: day.date,
          onDutyTime: { value: day.onDutyMinutes, unit: 'minute' },
        };
      })
    : record.priorDutyDays;
  const recapReturns = Array.isArray(record.recapReturns)
    ? record.recapReturns.map((value) => {
        const recap = typeof value === 'object' && value !== null && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {};
        return {
          sourceDate: recap.sourceDate,
          availableAt: recap.availableAt,
          returnedTime: { value: recap.returnedMinutes, unit: 'minute' },
        };
      })
    : record.recapReturns;
  const existingSleeperPeriods = Array.isArray(record.existingSleeperPeriods)
    ? record.existingSleeperPeriods.map((value) => {
        const period = typeof value === 'object' && value !== null && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {};
        return {
          id: period.id,
          startAt: period.startAt,
          endAt: period.endAt,
          duration: { value: period.durationMinutes, unit: 'minute' },
          candidateRole: period.candidateRole,
          ...(period.pairId === undefined ? {} : { pairId: period.pairId }),
          source: period.source,
          explanation: period.explanation,
        };
      })
    : record.existingSleeperPeriods;

  return validateDriverHosDepartureState({
    driver: {
      ...(record.driverId === undefined ? {} : { id: record.driverId }),
      nameOrIdentifier: record.driverNameOrIdentifier,
    },
    departureAt: record.departureAt,
    departureTimeZone: record.departureTimeZone,
    currentDutyStatus: record.currentDutyStatus,
    currentDutyStatusStartedAt: record.currentDutyStatusStartedAt,
    drivingTimeRemaining: { value: record.drivingMinutesRemaining, unit: 'minute' },
    shiftTimeRemaining: { value: record.shiftMinutesRemaining, unit: 'minute' },
    cycleTimeRemaining: { value: record.cycleMinutesRemaining, unit: 'minute' },
    cycleType: record.cycleType,
    drivenSinceLastQualifyingInterruption: { value: record.drivenMinutesSinceLastQualifyingInterruption, unit: 'minute' },
    onDutyTimeCurrentShift: { value: record.onDutyMinutesCurrentShift, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: record.offDutyMinutesImmediatelyBeforeDeparture, unit: 'minute' },
    qualifyingTenHourBreakCompleted: record.qualifyingTenHourBreakCompleted,
    priorDutyDays,
    recapReturns,
    sleeperBerthEligible: record.sleeperBerthEligible,
    existingSleeperPeriods,
    splitSleeperEnabled: record.splitSleeperEnabled,
    restart34HourPlanned: record.restart34HourPlanned,
    carrierMaxDailyDriving: { value: record.carrierMaxDailyDrivingMinutes, unit: 'minute' },
    carrierMaxDuty: { value: record.carrierMaxDutyMinutes, unit: 'minute' },
    ...(record.nightlyRestPreference === undefined ? {} : { nightlyRestPreference: record.nightlyRestPreference }),
    provenance: record.provenance,
  });
}

export function driverHosDepartureStateToApi(state: DriverHosDepartureState): DriverHosDepartureApiModel {
  return freeze({
    ...(state.driver.id === undefined ? {} : { driverId: state.driver.id }),
    driverNameOrIdentifier: state.driver.nameOrIdentifier,
    departureAt: state.departureAt,
    departureTimeZone: state.departureTimeZone,
    currentDutyStatus: state.currentDutyStatus,
    currentDutyStatusStartedAt: state.currentDutyStatusStartedAt,
    drivingMinutesRemaining: state.drivingTimeRemaining.value,
    shiftMinutesRemaining: state.shiftTimeRemaining.value,
    cycleMinutesRemaining: state.cycleTimeRemaining.value,
    cycleType: state.cycleType,
    drivenMinutesSinceLastQualifyingInterruption: state.drivenSinceLastQualifyingInterruption.value,
    onDutyMinutesCurrentShift: state.onDutyTimeCurrentShift.value,
    offDutyMinutesImmediatelyBeforeDeparture: state.offDutyTimeImmediatelyBeforeDeparture.value,
    qualifyingTenHourBreakCompleted: state.qualifyingTenHourBreakCompleted,
    priorDutyDays: freeze(state.priorDutyDays.map((day) => freeze({ date: day.date, onDutyMinutes: day.onDutyTime.value }))),
    recapReturns: freeze(state.recapReturns.map((recap) => freeze({ sourceDate: recap.sourceDate, availableAt: recap.availableAt, returnedMinutes: recap.returnedTime.value }))),
    sleeperBerthEligible: state.sleeperBerthEligible,
    existingSleeperPeriods: freeze(state.existingSleeperPeriods.map((period) => freeze({
      id: period.id,
      startAt: period.startAt,
      endAt: period.endAt,
      durationMinutes: period.duration.value,
      candidateRole: period.candidateRole,
      ...(period.pairId === undefined ? {} : { pairId: period.pairId }),
      source: period.source,
      explanation: period.explanation,
    }))),
    splitSleeperEnabled: state.splitSleeperEnabled,
    restart34HourPlanned: state.restart34HourPlanned,
    carrierMaxDailyDrivingMinutes: state.carrierMaxDailyDriving.value,
    carrierMaxDutyMinutes: state.carrierMaxDuty.value,
    ...(state.nightlyRestPreference === undefined ? {} : { nightlyRestPreference: state.nightlyRestPreference }),
    provenance: state.provenance,
  });
}

export function serializeDriverHosDepartureState(state: DriverHosDepartureState): string {
  return JSON.stringify(driverHosDepartureStateToApi(state));
}

export function deserializeDriverHosDepartureState(serialized: string): DriverHosDepartureState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new HosValidationError([{ code: 'INVALID_VALUE', path: 'serializedDepartureState', message: 'Expected valid JSON.' }]);
  }
  return driverHosDepartureStateFromApi(parsed);
}

export function serializeDutyEventHistory(events: readonly DutyEvent[]): string {
  return JSON.stringify(validateDutyEventHistory(events));
}

export function deserializeDutyEventHistory(serialized: string, options: DutyEventHistoryValidationOptions = {}): readonly DutyEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new HosValidationError([{ code: 'INVALID_VALUE', path: 'serializedDutyEvents', message: 'Expected valid JSON.' }]);
  }
  return validateDutyEventHistory(parsed, options);
}
