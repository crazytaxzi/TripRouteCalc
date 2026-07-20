import { Temporal } from '@js-temporal/polyfill';

import type {
  HosCoreCalculationResult,
  HosCoreClockSnapshot,
} from './hos-core.js';
import {
  validateDriverHosDepartureState,
  validateDutyEventHistory,
} from './hos.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
  SleeperCandidateRole,
} from './hos.js';
import { utcInstant } from './time.js';
import type { UtcInstant } from './time.js';
import { durationInMinutes } from './units.js';
import type { Duration } from './units.js';

export const STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES = Object.freeze({
  id: 'US_FEDERAL_PROPERTY_CARRYING_ADVANCED_HOS' as const,
  revision: 'stage-07-v1' as const,
  sleeperPair: Object.freeze({
    minimumPeriodMinutes: 2 * 60,
    minimumLongSleeperMinutes: 7 * 60,
    minimumCombinedMinutes: 10 * 60,
    drivingLimitMinutes: 11 * 60,
    shiftWindowMinutes: 14 * 60,
  }),
  adverseDrivingConditions: Object.freeze({
    maximumExtensionMinutes: 2 * 60,
    supportedConfidence: Object.freeze(['SUPPORTED', 'VERIFIED'] as const),
  }),
  unsupportedAutomaticRules: Object.freeze([
    'PERSONAL_CONVEYANCE',
    'SHORT_HAUL_EXCEPTION',
    'SIXTEEN_HOUR_EXCEPTION',
    'AGRICULTURAL_EXEMPTION',
    'EMERGENCY_DECLARATION',
    'EMERGENCY_CONDITIONS_EXCEPTION',
    'FLEXIBLE_SLEEPER_BERTH_PILOT',
    'SPLIT_DUTY_PERIOD_PILOT',
    'OTHER_EXCEPTION_OR_EXEMPTION',
  ] as const),
});

export type HosAdverseConditionType =
  | 'SNOW'
  | 'ICE'
  | 'SLEET'
  | 'FOG'
  | 'OTHER_ADVERSE_WEATHER'
  | 'UNUSUAL_ROAD_OR_TRAFFIC_CONDITION';

export type HosAdversePurpose = 'COMPLETE_RUN' | 'REACH_SAFE_PLACE';
export type HosEvidenceConfidence = 'LOW' | 'SUPPORTED' | 'VERIFIED';

export interface HosAdverseDrivingConditionSelection {
  readonly id: string;
  readonly encounteredAt: UtcInstant;
  readonly conditionType: HosAdverseConditionType;
  readonly description: string;
  readonly requestedExtension: Duration;
  readonly purpose: HosAdversePurpose;
  readonly normalRunWasLegallyCompletable: boolean;
  readonly driverCouldNotReasonablyKnowBeforeDutyOrQualifyingRest: boolean;
  readonly carrierCouldNotReasonablyKnowBeforeDispatch: boolean;
  readonly conditionPreventedSafeCompletionWithinNormalLimits: boolean;
  readonly source: string;
  readonly confidence: HosEvidenceConfidence;
  readonly explanation: string;
}

export type HosUnsupportedSpecialRule =
  typeof STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.unsupportedAutomaticRules[number];

export interface HosUnsupportedSpecialRuleSelection {
  readonly rule: HosUnsupportedSpecialRule;
  readonly source: string;
  readonly explanation: string;
}

export interface HosAdvancedCalculationInput {
  readonly departureState: DriverHosDepartureState;
  readonly historicalDutyEvents: readonly DutyEvent[];
  readonly dutyEvents: readonly DutyEvent[];
  readonly coreResult: HosCoreCalculationResult;
  readonly selectedSleeperPairId?: string;
  readonly adverseDrivingCondition?: HosAdverseDrivingConditionSelection;
  readonly unsupportedSpecialRuleSelections?: readonly HosUnsupportedSpecialRuleSelection[];
}

export type HosAdvancedValidationIssueCode =
  | 'CORE_RESULT_MISMATCH'
  | 'HISTORY_DEPARTURE_MISMATCH'
  | 'INVALID_SELECTED_PAIR_ID'
  | 'INVALID_UNSUPPORTED_SELECTION';

export interface HosAdvancedValidationIssue {
  readonly code: HosAdvancedValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class HosAdvancedValidationError extends Error {
  public override readonly name = 'HosAdvancedValidationError';

  public constructor(
    public readonly issues: readonly HosAdvancedValidationIssue[],
  ) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
}

export type HosSleeperPairIssueCode =
  | 'PAIR_NOT_SELECTED'
  | 'SPLIT_SLEEPER_NOT_ENABLED'
  | 'SLEEPER_NOT_ELIGIBLE'
  | 'PAIR_REQUIRES_TWO_PERIODS'
  | 'PAIR_REQUIRES_DISTINCT_ROLES'
  | 'PERIOD_SHORTER_THAN_TWO_HOURS'
  | 'LONG_PERIOD_NOT_IN_SLEEPER_BERTH'
  | 'LONG_PERIOD_SHORTER_THAN_SEVEN_HOURS'
  | 'PAIR_TOTAL_SHORTER_THAN_TEN_HOURS'
  | 'PAIR_PERIODS_OVERLAP'
  | 'PERIOD_NOT_FOUND_IN_DUTY_HISTORY'
  | 'INCOMPLETE_PRE_PAIR_DUTY_HISTORY'
  | 'STANDARD_RESET_SUPERSEDES_PAIR'
  | 'DRIVING_LIMIT_AROUND_FIRST_PERIOD_EXCEEDED'
  | 'SHIFT_WINDOW_AROUND_FIRST_PERIOD_EXCEEDED'
  | 'DRIVING_LIMIT_AFTER_FIRST_PERIOD_EXCEEDED'
  | 'SHIFT_WINDOW_AFTER_FIRST_PERIOD_EXCEEDED';

export interface HosSleeperPairIssue {
  readonly code: HosSleeperPairIssueCode;
  readonly message: string;
}

export type HosSleeperPeriodSource = 'EXISTING_EVIDENCE' | 'DUTY_EVENT';

export interface HosSleeperPeriodCandidate {
  readonly id: string;
  readonly pairId: string;
  readonly role: SleeperCandidateRole;
  readonly source: HosSleeperPeriodSource;
  readonly dutyStatus: Extract<HosDutyStatus, 'OFF_DUTY' | 'SLEEPER_BERTH'>;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly duration: Duration;
}

export interface HosSleeperPairRecalculation {
  readonly recalculatedAt: UtcInstant;
  readonly recalculationAnchorAt: UtcInstant;
  readonly drivingTimeBetweenPeriods: Duration;
  readonly dutyWindowTimeBetweenPeriods: Duration;
  readonly onDutyTimeBetweenPeriods: Duration;
  readonly drivingTimeRemaining: Duration;
  readonly shiftTimeRemaining: Duration;
  readonly cycleEffect: 'UNCHANGED';
  readonly explanation: string;
}

export type HosSleeperPairStatus =
  | 'VALID_SELECTED_AND_APPLIED'
  | 'VALID_NOT_SELECTED'
  | 'INVALID';

export interface HosSleeperPairEvaluation {
  readonly pairId: string;
  readonly status: HosSleeperPairStatus;
  readonly selected: boolean;
  readonly periods: readonly HosSleeperPeriodCandidate[];
  readonly issues: readonly HosSleeperPairIssue[];
  readonly totalQualifyingRest: Duration;
  readonly recalculation?: HosSleeperPairRecalculation;
  readonly explanation: string;
}

export interface HosSleeperEvaluationResult {
  readonly enabled: boolean;
  readonly eligible: boolean;
  readonly selectedPairId?: string;
  readonly pairs: readonly HosSleeperPairEvaluation[];
  readonly appliedPair?: HosSleeperPairEvaluation;
  readonly warnings: readonly string[];
}

export type HosAdverseIssueCode =
  | 'NOT_EXPLICITLY_SELECTED'
  | 'INVALID_EXTENSION_DURATION'
  | 'EXTENSION_EXCEEDS_TWO_HOURS'
  | 'ENCOUNTER_TIMESTAMP_NOT_EVENT_BOUNDARY'
  | 'CONDITION_WAS_OR_COULD_BE_KNOWN'
  | 'CARRIER_KNEW_OR_SHOULD_HAVE_KNOWN'
  | 'RUN_NOT_NORMALLY_COMPLETABLE'
  | 'SAFE_COMPLETION_NOT_PREVENTED'
  | 'INSUFFICIENT_EVIDENCE_CONFIDENCE'
  | 'MISSING_SOURCE_OR_EXPLANATION'
  | 'BLOCKED_BY_UNEXTENDED_RULE';

export interface HosAdverseIssue {
  readonly code: HosAdverseIssueCode;
  readonly message: string;
}

export type HosAdverseStatus = 'NOT_SELECTED' | 'APPLIED' | 'REJECTED';

export interface HosAdverseDrivingConditionResult {
  readonly status: HosAdverseStatus;
  readonly selection?: HosAdverseDrivingConditionSelection;
  readonly issues: readonly HosAdverseIssue[];
  readonly appliedAt?: UtcInstant;
  readonly normalDrivingTimeRemainingAtSelection?: Duration;
  readonly normalShiftTimeRemainingAtSelection?: Duration;
  readonly extendedDrivingTimeRemainingAtSelection?: Duration;
  readonly extendedShiftTimeRemainingAtSelection?: Duration;
  readonly federalDrivingLimit: Duration;
  readonly federalShiftWindow: Duration;
  readonly cycleEffect: 'UNCHANGED';
  readonly interruptionEffect: 'UNCHANGED';
  readonly explanation: string;
}

export type HosCarrierPolicyViolationCode =
  | 'CARRIER_DRIVING_CAP_EXCEEDED'
  | 'CARRIER_DUTY_CAP_EXCEEDED';

export interface HosCarrierPolicyViolation {
  readonly code: HosCarrierPolicyViolationCode;
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly prohibitedTime: Duration;
  readonly explanation: string;
}

export interface HosPreferredRestConflict {
  readonly eventId: string;
  readonly firstConflictAt: UtcInstant;
  readonly conflictingTime: Duration;
  readonly explanation: string;
}

export interface HosCarrierPolicyResult {
  readonly maximumDailyDriving: Duration;
  readonly maximumDuty: Duration;
  readonly drivingPolicyIsStricterThanFederalStandard: boolean;
  readonly dutyPolicyIsStricterThanFederalStandard: boolean;
  readonly finalDrivingTimeRemaining: Duration;
  readonly finalDutyTimeRemaining: Duration;
  readonly canPerformCarrierAuthorizedDriving: boolean;
  readonly violations: readonly HosCarrierPolicyViolation[];
  readonly preferredRestWindow: Readonly<{
    readonly status: 'NOT_CONFIGURED' | 'SATISFIED' | 'CONFLICT';
    readonly conflicts: readonly HosPreferredRestConflict[];
    readonly explanation: string;
  }>;
  readonly explanation: string;
}

export interface HosUnsupportedRuleWarning {
  readonly rule: HosUnsupportedSpecialRule;
  readonly severity: 'BLOCKING';
  readonly source: string;
  readonly explanation: string;
}

export interface HosAdvancedCalculationResult {
  readonly ruleSet: typeof STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES;
  readonly sleeper: HosSleeperEvaluationResult;
  readonly adverseDrivingCondition: HosAdverseDrivingConditionResult;
  readonly carrierPolicy: HosCarrierPolicyResult;
  readonly unsupportedRuleWarnings: readonly HosUnsupportedRuleWarning[];
  readonly clockAlterationBlocked: boolean;
  readonly reasons: readonly string[];
}

interface MutableCarrierState {
  drivingMinutes: number;
  dutyMinutes: number;
}

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

function exactMinutes(startAt: UtcInstant, endAt: UtcInstant): number {
  const milliseconds = instantMilliseconds(endAt) - instantMilliseconds(startAt);
  if (milliseconds < 0 || milliseconds % 60_000 !== 0) {
    throw new HosAdvancedValidationError([freeze({
      code: 'HISTORY_DEPARTURE_MISMATCH',
      path: 'dutyEvents',
      message: 'Advanced HOS timestamps must move forward on whole-minute boundaries.',
    })]);
  }
  return milliseconds / 60_000;
}

function addMinutes(value: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(
    Temporal.Instant.from(value).add({ minutes }).toString({
      smallestUnit: 'millisecond',
    }),
  );
}

function isRest(status: HosDutyStatus): status is 'OFF_DUTY' | 'SLEEPER_BERTH' {
  return status === 'OFF_DUTY' || status === 'SLEEPER_BERTH';
}

function isOnDuty(status: HosDutyStatus): boolean {
  return status === 'DRIVING' || status === 'ON_DUTY_NOT_DRIVING';
}

function validateCoreComposition(
  departureState: DriverHosDepartureState,
  dutyEvents: readonly DutyEvent[],
  coreResult: HosCoreCalculationResult,
): void {
  const issues: HosAdvancedValidationIssue[] = [];
  if (compareInstants(coreResult.initial.at, departureState.departureAt) !== 0) {
    issues.push(freeze({
      code: 'CORE_RESULT_MISMATCH',
      path: 'coreResult.initial.at',
      message: 'The Stage 05 result must begin at the same departure instant.',
    }));
  }
  if (coreResult.transitions.length !== dutyEvents.length) {
    issues.push(freeze({
      code: 'CORE_RESULT_MISMATCH',
      path: 'coreResult.transitions',
      message: 'The Stage 05 transition count must match the supplied duty-event sequence.',
    }));
  } else {
    dutyEvents.forEach((event, index) => {
      const transition = coreResult.transitions[index];
      if (
        transition === undefined
        || transition.event.id !== event.id
        || compareInstants(transition.event.startAt, event.startAt) !== 0
        || compareInstants(transition.event.endAt, event.endAt) !== 0
      ) {
        issues.push(freeze({
          code: 'CORE_RESULT_MISMATCH',
          path: `coreResult.transitions[${String(index)}]`,
          message: 'Each Stage 05 transition must correspond to the same ordered duty event.',
        }));
      }
    });
  }
  if (issues.length > 0) throw new HosAdvancedValidationError(freeze(issues));
}

function validateUnsupportedSelections(
  selections: readonly HosUnsupportedSpecialRuleSelection[],
): void {
  const issues: HosAdvancedValidationIssue[] = [];
  const seen = new Set<HosUnsupportedSpecialRule>();
  selections.forEach((selection, index) => {
    if (seen.has(selection.rule)) {
      issues.push(freeze({
        code: 'INVALID_UNSUPPORTED_SELECTION',
        path: `unsupportedSpecialRuleSelections[${String(index)}].rule`,
        message: 'Each unsupported rule may be selected only once.',
      }));
    }
    seen.add(selection.rule);
    if (selection.source.trim() === '' || selection.explanation.trim() === '') {
      issues.push(freeze({
        code: 'INVALID_UNSUPPORTED_SELECTION',
        path: `unsupportedSpecialRuleSelections[${String(index)}]`,
        message: 'Unsupported selections require a source and explanation.',
      }));
    }
  });
  if (issues.length > 0) throw new HosAdvancedValidationError(freeze(issues));
}

function candidateFromExisting(
  value: DriverHosDepartureState['existingSleeperPeriods'][number],
): HosSleeperPeriodCandidate | undefined {
  if (value.pairId === undefined) return undefined;
  return freeze({
    id: value.id,
    pairId: value.pairId,
    role: value.candidateRole,
    source: 'EXISTING_EVIDENCE',
    dutyStatus: 'SLEEPER_BERTH',
    startAt: value.startAt,
    endAt: value.endAt,
    duration: value.duration,
  });
}

function candidateFromEvent(event: DutyEvent): HosSleeperPeriodCandidate | undefined {
  if (
    !event.sleeperPair.participates
    || event.sleeperPair.pairId === undefined
    || event.sleeperPair.candidateRole === undefined
    || !isRest(event.dutyStatus)
  ) {
    return undefined;
  }
  return freeze({
    id: event.id,
    pairId: event.sleeperPair.pairId,
    role: event.sleeperPair.candidateRole,
    source: 'DUTY_EVENT',
    dutyStatus: event.dutyStatus,
    startAt: event.startAt,
    endAt: event.endAt,
    duration: event.duration,
  });
}

function collectCandidates(
  departureState: DriverHosDepartureState,
  dutyEvents: readonly DutyEvent[],
): ReadonlyMap<string, readonly HosSleeperPeriodCandidate[]> {
  const grouped = new Map<string, HosSleeperPeriodCandidate[]>();
  const candidates = [
    ...departureState.existingSleeperPeriods.map(candidateFromExisting),
    ...dutyEvents.map(candidateFromEvent),
  ].filter((value): value is HosSleeperPeriodCandidate => value !== undefined);
  candidates.forEach((candidate) => {
    const group = grouped.get(candidate.pairId) ?? [];
    group.push(candidate);
    grouped.set(candidate.pairId, group);
  });
  return new Map(
    [...grouped.entries()].map(([pairId, values]) => [
      pairId,
      freeze(values.sort((left, right) => compareInstants(left.startAt, right.startAt))),
    ]),
  );
}

function findExactEvent(
  events: readonly DutyEvent[],
  candidate: HosSleeperPeriodCandidate,
): DutyEvent | undefined {
  return events.find((event) =>
    compareInstants(event.startAt, candidate.startAt) === 0
    && compareInstants(event.endAt, candidate.endAt) === 0
    && event.dutyStatus === candidate.dutyStatus);
}

function sumDriving(
  events: readonly DutyEvent[],
  startAt: UtcInstant,
  endAt: UtcInstant,
): number {
  return events.reduce((total, event) => {
    if (event.dutyStatus !== 'DRIVING') return total;
    const start = compareInstants(event.startAt, startAt) < 0 ? startAt : event.startAt;
    const end = compareInstants(event.endAt, endAt) > 0 ? endAt : event.endAt;
    return compareInstants(start, end) < 0 ? total + exactMinutes(start, end) : total;
  }, 0);
}

function sumOnDuty(
  events: readonly DutyEvent[],
  startAt: UtcInstant,
  endAt: UtcInstant,
): number {
  return events.reduce((total, event) => {
    if (!isOnDuty(event.dutyStatus)) return total;
    const start = compareInstants(event.startAt, startAt) < 0 ? startAt : event.startAt;
    const end = compareInstants(event.endAt, endAt) > 0 ? endAt : event.endAt;
    return compareInstants(start, end) < 0 ? total + exactMinutes(start, end) : total;
  }, 0);
}

function hasTenHourReset(
  events: readonly DutyEvent[],
  startAt: UtcInstant,
  endAt: UtcInstant,
): boolean {
  let streak = 0;
  let cursor = startAt;
  for (const event of events) {
    if (compareInstants(event.endAt, startAt) <= 0) continue;
    if (compareInstants(event.startAt, endAt) >= 0) break;
    const segmentStart = compareInstants(event.startAt, cursor) < 0 ? cursor : event.startAt;
    const segmentEnd = compareInstants(event.endAt, endAt) > 0 ? endAt : event.endAt;
    if (compareInstants(segmentStart, segmentEnd) >= 0) continue;
    if (compareInstants(segmentStart, cursor) !== 0 || !isRest(event.dutyStatus)) {
      streak = 0;
    }
    if (isRest(event.dutyStatus)) {
      streak += exactMinutes(segmentStart, segmentEnd);
      if (streak >= 600) return true;
    }
    cursor = segmentEnd;
  }
  return false;
}

function findDutyWindowStart(
  events: readonly DutyEvent[],
  firstPeriodStartAt: UtcInstant,
  departureState: DriverHosDepartureState,
): UtcInstant | undefined {
  let restStreakMinutes = 0;
  let resetAvailable = false;
  let dutyWindowStart: UtcInstant | undefined;
  for (const event of events) {
    if (compareInstants(event.startAt, firstPeriodStartAt) >= 0) break;
    const endAt = compareInstants(event.endAt, firstPeriodStartAt) > 0
      ? firstPeriodStartAt
      : event.endAt;
    const segmentMinutes = exactMinutes(event.startAt, endAt);
    if (isRest(event.dutyStatus)) {
      restStreakMinutes += segmentMinutes;
      if (restStreakMinutes >= 600) resetAvailable = true;
      continue;
    }
    if (resetAvailable) {
      dutyWindowStart = event.startAt;
    }
    restStreakMinutes = 0;
    resetAvailable = false;
  }
  if (dutyWindowStart !== undefined) return dutyWindowStart;
  if (
    compareInstants(firstPeriodStartAt, departureState.departureAt) >= 0
    && departureState.qualifyingTenHourBreakCompleted
  ) {
    return departureState.departureAt;
  }
  return undefined;
}

function pairIssue(
  code: HosSleeperPairIssueCode,
  message: string,
): HosSleeperPairIssue {
  return freeze({ code, message });
}

function evaluatePair(
  pairId: string,
  periods: readonly HosSleeperPeriodCandidate[],
  selectedPairId: string | undefined,
  departureState: DriverHosDepartureState,
  allEvents: readonly DutyEvent[],
): HosSleeperPairEvaluation {
  const rules = STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.sleeperPair;
  const issues: HosSleeperPairIssue[] = [];
  const selected = selectedPairId === pairId;
  if (selected && !departureState.splitSleeperEnabled) {
    issues.push(pairIssue(
      'SPLIT_SLEEPER_NOT_ENABLED',
      'The selected pair cannot alter clocks because split sleeper was not enabled for the plan.',
    ));
  }
  if (selected && !departureState.sleeperBerthEligible) {
    issues.push(pairIssue(
      'SLEEPER_NOT_ELIGIBLE',
      'The selected pair cannot alter clocks because sleeper-berth eligibility was not recorded.',
    ));
  }
  if (periods.length !== 2) {
    issues.push(pairIssue(
      'PAIR_REQUIRES_TWO_PERIODS',
      'A qualifying split must contain exactly two explicitly paired periods.',
    ));
  }
  const longPeriods = periods.filter((period) => period.role === 'LONG_PERIOD');
  const shortPeriods = periods.filter((period) => period.role === 'SHORT_PERIOD');
  if (longPeriods.length !== 1 || shortPeriods.length !== 1) {
    issues.push(pairIssue(
      'PAIR_REQUIRES_DISTINCT_ROLES',
      'A pair must identify exactly one long period and one short period.',
    ));
  }
  periods.forEach((period) => {
    if (period.duration.value < rules.minimumPeriodMinutes) {
      issues.push(pairIssue(
        'PERIOD_SHORTER_THAN_TWO_HOURS',
        `Period ${period.id} is shorter than two consecutive hours.`,
      ));
    }
    if (period.source === 'EXISTING_EVIDENCE' && findExactEvent(allEvents, period) === undefined) {
      issues.push(pairIssue(
        'PERIOD_NOT_FOUND_IN_DUTY_HISTORY',
        `Existing period ${period.id} does not have an exact sleeper-berth event in the supplied history.`,
      ));
    }
  });
  const longPeriod = longPeriods[0];
  if (longPeriod !== undefined) {
    if (longPeriod.dutyStatus !== 'SLEEPER_BERTH') {
      issues.push(pairIssue(
        'LONG_PERIOD_NOT_IN_SLEEPER_BERTH',
        'The period of at least seven consecutive hours must be spent in the sleeper berth.',
      ));
    }
    if (longPeriod.duration.value < rules.minimumLongSleeperMinutes) {
      issues.push(pairIssue(
        'LONG_PERIOD_SHORTER_THAN_SEVEN_HOURS',
        'The long sleeper period is shorter than seven consecutive hours.',
      ));
    }
  }
  const totalMinutes = periods.reduce((total, period) => total + period.duration.value, 0);
  if (totalMinutes < rules.minimumCombinedMinutes) {
    issues.push(pairIssue(
      'PAIR_TOTAL_SHORTER_THAN_TEN_HOURS',
      'The paired periods total less than ten hours.',
    ));
  }
  const [first, second] = periods;
  if (first !== undefined && second !== undefined) {
    if (compareInstants(first.endAt, second.startAt) > 0) {
      issues.push(pairIssue(
        'PAIR_PERIODS_OVERLAP',
        'Paired rest periods may not overlap.',
      ));
    }
    if (
      first.duration.value >= 600
      || second.duration.value >= 600
      || hasTenHourReset(allEvents, first.endAt, second.startAt)
    ) {
      issues.push(pairIssue(
        'STANDARD_RESET_SUPERSEDES_PAIR',
        'A qualifying ten-consecutive-hour reset exists, so this split pair is not used to alter clocks.',
      ));
    }
  }

  let recalculation: HosSleeperPairRecalculation | undefined;
  if (issues.length === 0 && first !== undefined && second !== undefined) {
    const dutyWindowStart = findDutyWindowStart(
      allEvents,
      first.startAt,
      departureState,
    );
    if (dutyWindowStart === undefined) {
      issues.push(pairIssue(
        'INCOMPLETE_PRE_PAIR_DUTY_HISTORY',
        'The supplied history does not establish the duty-window start before the first paired period.',
      ));
    } else {
      const drivingBeforeFirst = sumDriving(
        allEvents,
        dutyWindowStart,
        first.startAt,
      );
      const drivingBetween = sumDriving(allEvents, first.endAt, second.startAt);
      const firstWindowMinutes = exactMinutes(dutyWindowStart, first.startAt)
        + exactMinutes(first.endAt, second.startAt);
      const secondWindowMinutes = exactMinutes(first.endAt, second.startAt);
      if (drivingBeforeFirst + drivingBetween > rules.drivingLimitMinutes) {
        issues.push(pairIssue(
          'DRIVING_LIMIT_AROUND_FIRST_PERIOD_EXCEEDED',
          'Driving immediately before and after the first paired period exceeds eleven hours.',
        ));
      }
      if (firstWindowMinutes > rules.shiftWindowMinutes) {
        issues.push(pairIssue(
          'SHIFT_WINDOW_AROUND_FIRST_PERIOD_EXCEEDED',
          'The 14-hour window around the first paired period is exceeded after excluding that qualifying period.',
        ));
      }
      if (drivingBetween > rules.drivingLimitMinutes) {
        issues.push(pairIssue(
          'DRIVING_LIMIT_AFTER_FIRST_PERIOD_EXCEEDED',
          'Driving after the first paired period exceeds eleven hours before the second period completes.',
        ));
      }
      if (secondWindowMinutes > rules.shiftWindowMinutes) {
        issues.push(pairIssue(
          'SHIFT_WINDOW_AFTER_FIRST_PERIOD_EXCEEDED',
          'The recalculated 14-hour window from the end of the first period is exceeded.',
        ));
      }
      if (issues.length === 0) {
        recalculation = freeze({
          recalculatedAt: second.endAt,
          recalculationAnchorAt: first.endAt,
          drivingTimeBetweenPeriods: duration(drivingBetween),
          dutyWindowTimeBetweenPeriods: duration(secondWindowMinutes),
          onDutyTimeBetweenPeriods: duration(sumOnDuty(
            allEvents,
            first.endAt,
            second.startAt,
          )),
          drivingTimeRemaining: duration(rules.drivingLimitMinutes - drivingBetween),
          shiftTimeRemaining: duration(rules.shiftWindowMinutes - secondWindowMinutes),
          cycleEffect: 'UNCHANGED',
          explanation: `At ${second.endAt}, the 11-hour and 14-hour clocks are recalculated from the end of the first paired period at ${first.endAt}; neither qualifying period changes cycle availability.`,
        });
      }
    }
  }

  const valid = issues.length === 0 && recalculation !== undefined;
  const status: HosSleeperPairStatus = valid
    ? selected && departureState.splitSleeperEnabled && departureState.sleeperBerthEligible
      ? 'VALID_SELECTED_AND_APPLIED'
      : 'VALID_NOT_SELECTED'
    : 'INVALID';
  return freeze({
    pairId,
    status,
    selected,
    periods,
    issues: freeze(issues),
    totalQualifyingRest: duration(totalMinutes),
    ...(recalculation === undefined ? {} : { recalculation }),
    explanation: valid
      ? status === 'VALID_SELECTED_AND_APPLIED'
        ? 'The explicitly selected pair is fully supported and may alter the 11-hour and 14-hour clocks.'
        : 'The pair qualifies, but it was not both selected and enabled, so no clock alteration was applied.'
      : 'The pair failed one or more federal sleeper-pair requirements and did not alter any clock.',
  });
}

function evaluateSleeper(
  departureState: DriverHosDepartureState,
  historicalDutyEvents: readonly DutyEvent[],
  dutyEvents: readonly DutyEvent[],
  selectedPairId: string | undefined,
): HosSleeperEvaluationResult {
  const grouped = collectCandidates(departureState, dutyEvents);
  const allEvents = freeze([...historicalDutyEvents, ...dutyEvents]);
  const pairs = freeze([...grouped.entries()].map(([pairId, periods]) =>
    evaluatePair(
      pairId,
      periods,
      selectedPairId,
      departureState,
      allEvents,
    )));
  const appliedPair = pairs.find((pair) => pair.status === 'VALID_SELECTED_AND_APPLIED');
  const warnings: string[] = [];
  if (departureState.splitSleeperEnabled && selectedPairId === undefined) {
    warnings.push('Split sleeper is enabled, but no pair was explicitly selected; no clocks were altered.');
  }
  if (selectedPairId !== undefined && !grouped.has(selectedPairId)) {
    warnings.push(`Selected sleeper pair ${selectedPairId} was not found; no clocks were altered.`);
  }
  if (selectedPairId !== undefined && appliedPair === undefined) {
    warnings.push(`Selected sleeper pair ${selectedPairId} did not fully qualify; no clocks were altered.`);
  }
  return freeze({
    enabled: departureState.splitSleeperEnabled,
    eligible: departureState.sleeperBerthEligible,
    ...(selectedPairId === undefined ? {} : { selectedPairId }),
    pairs,
    ...(appliedPair === undefined ? {} : { appliedPair }),
    warnings: freeze(warnings),
  });
}

function snapshotAtBoundary(
  coreResult: HosCoreCalculationResult,
  at: UtcInstant,
): HosCoreClockSnapshot | undefined {
  if (compareInstants(coreResult.initial.at, at) === 0) return coreResult.initial;
  for (const transition of coreResult.transitions) {
    if (compareInstants(transition.before.at, at) === 0) return transition.before;
    if (compareInstants(transition.after.at, at) === 0) return transition.after;
  }
  return undefined;
}

function adverseIssue(
  code: HosAdverseIssueCode,
  message: string,
): HosAdverseIssue {
  return freeze({ code, message });
}

function evaluateAdverse(
  selection: HosAdverseDrivingConditionSelection | undefined,
  coreResult: HosCoreCalculationResult,
): HosAdverseDrivingConditionResult {
  const standardDriving = STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.sleeperPair
    .drivingLimitMinutes;
  const standardShift = STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.sleeperPair
    .shiftWindowMinutes;
  if (selection === undefined) {
    return freeze({
      status: 'NOT_SELECTED',
      issues: freeze([adverseIssue(
        'NOT_EXPLICITLY_SELECTED',
        'No adverse-driving-condition exception was explicitly selected.',
      )]),
      federalDrivingLimit: duration(standardDriving),
      federalShiftWindow: duration(standardShift),
      cycleEffect: 'UNCHANGED',
      interruptionEffect: 'UNCHANGED',
      explanation: 'No adverse extension was applied automatically.',
    });
  }
  const issues: HosAdverseIssue[] = [];
  const extension = selection.requestedExtension.value;
  if (!Number.isSafeInteger(extension) || extension <= 0) {
    issues.push(adverseIssue(
      'INVALID_EXTENSION_DURATION',
      'The requested extension must be a positive whole-minute duration.',
    ));
  }
  if (
    extension
      > STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.adverseDrivingConditions
        .maximumExtensionMinutes
  ) {
    issues.push(adverseIssue(
      'EXTENSION_EXCEEDS_TWO_HOURS',
      'The adverse-driving-condition extension may not exceed 120 minutes.',
    ));
  }
  const snapshot = snapshotAtBoundary(coreResult, selection.encounteredAt);
  if (snapshot === undefined) {
    issues.push(adverseIssue(
      'ENCOUNTER_TIMESTAMP_NOT_EVENT_BOUNDARY',
      'The encounter timestamp must match departure or an exact duty-event boundary.',
    ));
  }
  if (!selection.driverCouldNotReasonablyKnowBeforeDutyOrQualifyingRest) {
    issues.push(adverseIssue(
      'CONDITION_WAS_OR_COULD_BE_KNOWN',
      'The driver knew or reasonably could have known of the condition before the relevant duty or rest boundary.',
    ));
  }
  if (!selection.carrierCouldNotReasonablyKnowBeforeDispatch) {
    issues.push(adverseIssue(
      'CARRIER_KNEW_OR_SHOULD_HAVE_KNOWN',
      'The motor carrier knew or reasonably should have known of the condition before dispatch.',
    ));
  }
  if (!selection.normalRunWasLegallyCompletable) {
    issues.push(adverseIssue(
      'RUN_NOT_NORMALLY_COMPLETABLE',
      'The run was not documented as normally and reasonably completable within ordinary HOS limits.',
    ));
  }
  if (!selection.conditionPreventedSafeCompletionWithinNormalLimits) {
    issues.push(adverseIssue(
      'SAFE_COMPLETION_NOT_PREVENTED',
      'The supplied facts do not establish that the condition prevented safe completion within normal limits.',
    ));
  }
  if (selection.confidence === 'LOW') {
    issues.push(adverseIssue(
      'INSUFFICIENT_EVIDENCE_CONFIDENCE',
      'Low-confidence adverse-condition evidence is preserved but cannot alter legal clocks.',
    ));
  }
  if (
    selection.id.trim() === ''
    || selection.description.trim() === ''
    || selection.source.trim() === ''
    || selection.explanation.trim() === ''
  ) {
    issues.push(adverseIssue(
      'MISSING_SOURCE_OR_EXPLANATION',
      'An adverse selection requires an identifier, description, source, and explanation.',
    ));
  }
  if (snapshot !== undefined && snapshot.blockingReasons.some((reason) =>
    reason.code === 'CYCLE_LIMIT_REACHED'
    || reason.code === 'THIRTY_MINUTE_INTERRUPTION_REQUIRED')) {
    issues.push(adverseIssue(
      'BLOCKED_BY_UNEXTENDED_RULE',
      'Adverse driving conditions do not restore cycle availability or waive the 30-minute interruption.',
    ));
  }
  const applied = issues.length === 0 && snapshot !== undefined;
  return freeze({
    status: applied ? 'APPLIED' : 'REJECTED',
    selection,
    issues: freeze(issues),
    ...(applied && snapshot !== undefined
      ? {
          appliedAt: selection.encounteredAt,
          normalDrivingTimeRemainingAtSelection: snapshot.drivingTimeRemaining,
          normalShiftTimeRemainingAtSelection: snapshot.shiftTimeRemaining,
          extendedDrivingTimeRemainingAtSelection: duration(
            snapshot.drivingTimeRemaining.value + extension,
          ),
          extendedShiftTimeRemainingAtSelection: duration(
            snapshot.shiftTimeRemaining.value + extension,
          ),
        }
      : {}),
    federalDrivingLimit: duration(standardDriving + (applied ? extension : 0)),
    federalShiftWindow: duration(standardShift + (applied ? extension : 0)),
    cycleEffect: 'UNCHANGED',
    interruptionEffect: 'UNCHANGED',
    explanation: applied
      ? `The explicit adverse condition adds ${String(extension)} minute(s) to the federal driving limit and driving window at ${selection.encounteredAt}; cycle and interruption rules remain unchanged.`
      : 'The supplied adverse selection did not satisfy every required fact, so no clock extension was applied.',
  });
}

function firstPreferenceOverlap(
  event: DutyEvent,
  preference: NonNullable<DriverHosDepartureState['nightlyRestPreference']>,
): Readonly<{ firstAt: UtcInstant; minutes: number }> | undefined {
  const [startHourText = '0', startMinuteText = '0'] = preference.startLocalTime.split(':');
  const [endHourText = '0', endMinuteText = '0'] = preference.endLocalTime.split(':');
  const startMinute = Number(startHourText) * 60 + Number(startMinuteText);
  const endMinute = Number(endHourText) * 60 + Number(endMinuteText);
  let firstAt: UtcInstant | undefined;
  let minutes = 0;
  for (let offset = 0; offset < event.duration.value; offset += 1) {
    const instant = Temporal.Instant.from(event.startAt).add({ minutes: offset });
    const local = instant.toZonedDateTimeISO(preference.timeZone);
    const minuteOfDay = local.hour * 60 + local.minute;
    const within = startMinute === endMinute
      || startMinute < endMinute
        ? minuteOfDay >= startMinute && minuteOfDay < endMinute
        : minuteOfDay >= startMinute || minuteOfDay < endMinute;
    if (!within) continue;
    firstAt ??= utcInstant(instant.toString({ smallestUnit: 'millisecond' }));
    minutes += 1;
  }
  return firstAt === undefined ? undefined : freeze({ firstAt, minutes });
}

function carrierViolation(
  code: HosCarrierPolicyViolationCode,
  event: DutyEvent,
  occurredAt: UtcInstant,
  prohibitedMinutes: number,
  explanation: string,
): HosCarrierPolicyViolation {
  return freeze({
    code,
    eventId: event.id,
    occurredAt,
    prohibitedTime: duration(prohibitedMinutes),
    explanation,
  });
}

function evaluateCarrierPolicy(
  departureState: DriverHosDepartureState,
  dutyEvents: readonly DutyEvent[],
  coreResult: HosCoreCalculationResult,
  appliedPair: HosSleeperPairEvaluation | undefined,
): HosCarrierPolicyResult {
  const drivingCap = departureState.carrierMaxDailyDriving.value;
  const dutyCap = departureState.carrierMaxDuty.value;
  const standardDriving = STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.sleeperPair
    .drivingLimitMinutes;
  const standardDuty = STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES.sleeperPair
    .shiftWindowMinutes;
  const state: MutableCarrierState = {
    drivingMinutes: Math.max(0, standardDriving - departureState.drivingTimeRemaining.value),
    dutyMinutes: departureState.onDutyTimeCurrentShift.value,
  };
  const violations: HosCarrierPolicyViolation[] = [];
  const preferenceConflicts: HosPreferredRestConflict[] = [];
  const appliedPairSecondId = appliedPair?.periods[1]?.id;

  dutyEvents.forEach((event, index) => {
    const transition = coreResult.transitions[index];
    if (event.dutyStatus === 'DRIVING') {
      const drivingAvailable = Math.max(0, drivingCap - state.drivingMinutes);
      if (event.duration.value > drivingAvailable) {
        violations.push(carrierViolation(
          'CARRIER_DRIVING_CAP_EXCEEDED',
          event,
          addMinutes(event.startAt, drivingAvailable),
          event.duration.value - drivingAvailable,
          'Driving continued beyond the separately configured carrier daily-driving cap.',
        ));
      }
      const dutyAvailable = Math.max(0, dutyCap - state.dutyMinutes);
      if (event.duration.value > dutyAvailable) {
        violations.push(carrierViolation(
          'CARRIER_DUTY_CAP_EXCEEDED',
          event,
          addMinutes(event.startAt, dutyAvailable),
          event.duration.value - dutyAvailable,
          'On-duty time continued beyond the separately configured carrier duty cap.',
        ));
      }
      state.drivingMinutes += event.duration.value;
      state.dutyMinutes += event.duration.value;
    } else if (event.dutyStatus === 'ON_DUTY_NOT_DRIVING') {
      const dutyAvailable = Math.max(0, dutyCap - state.dutyMinutes);
      if (event.duration.value > dutyAvailable) {
        violations.push(carrierViolation(
          'CARRIER_DUTY_CAP_EXCEEDED',
          event,
          addMinutes(event.startAt, dutyAvailable),
          event.duration.value - dutyAvailable,
          'On-duty-not-driving work continued beyond the separately configured carrier duty cap.',
        ));
      }
      state.dutyMinutes += event.duration.value;
    }

    const preference = departureState.nightlyRestPreference;
    if (preference !== undefined && isOnDuty(event.dutyStatus)) {
      const overlap = firstPreferenceOverlap(event, preference);
      if (overlap !== undefined) {
        preferenceConflicts.push(freeze({
          eventId: event.id,
          firstConflictAt: overlap.firstAt,
          conflictingTime: duration(overlap.minutes),
          explanation: 'Planned work overlaps the driver or carrier preferred nightly rest window; this is a policy conflict, not a federal HOS violation.',
        }));
      }
    }

    if (transition?.milestones.tenHourResetCompletedAt !== undefined) {
      state.drivingMinutes = 0;
      state.dutyMinutes = 0;
    }
    if (
      appliedPairSecondId !== undefined
      && event.id === appliedPairSecondId
      && appliedPair?.recalculation !== undefined
    ) {
      state.drivingMinutes = appliedPair.recalculation.drivingTimeBetweenPeriods.value;
      state.dutyMinutes = appliedPair.recalculation.onDutyTimeBetweenPeriods.value;
    }
  });

  const preferredRestWindow = departureState.nightlyRestPreference === undefined
    ? freeze({
        status: 'NOT_CONFIGURED' as const,
        conflicts: freeze([] as HosPreferredRestConflict[]),
        explanation: 'No preferred nightly rest window was configured.',
      })
    : freeze({
        status: preferenceConflicts.length === 0 ? 'SATISFIED' as const : 'CONFLICT' as const,
        conflicts: freeze(preferenceConflicts),
        explanation: preferenceConflicts.length === 0
          ? 'The supplied duty-event sequence does not place work inside the preferred nightly rest window.'
          : 'One or more work events overlap the preferred nightly rest window and should be surfaced separately from federal legality.',
      });

  return freeze({
    maximumDailyDriving: departureState.carrierMaxDailyDriving,
    maximumDuty: departureState.carrierMaxDuty,
    drivingPolicyIsStricterThanFederalStandard: drivingCap < standardDriving,
    dutyPolicyIsStricterThanFederalStandard: dutyCap < standardDuty,
    finalDrivingTimeRemaining: duration(drivingCap - state.drivingMinutes),
    finalDutyTimeRemaining: duration(dutyCap - state.dutyMinutes),
    canPerformCarrierAuthorizedDriving:
      state.drivingMinutes < drivingCap && state.dutyMinutes < dutyCap,
    violations: freeze(violations),
    preferredRestWindow,
    explanation: 'Carrier limits and preferred rest windows were evaluated separately from federal legality and never increased a federal maximum.',
  });
}

function unsupportedWarnings(
  selections: readonly HosUnsupportedSpecialRuleSelection[],
): readonly HosUnsupportedRuleWarning[] {
  return freeze(selections.map((selection) => freeze({
    rule: selection.rule,
    severity: 'BLOCKING' as const,
    source: selection.source,
    explanation: `${selection.explanation} Stage 07 does not implement this exception, exemption, declaration, pilot program, or personal-conveyance eligibility; no clock was altered.`,
  })));
}

export function calculateHosAdvancedRules(
  input: HosAdvancedCalculationInput,
): HosAdvancedCalculationResult {
  const departureState = validateDriverHosDepartureState(input.departureState);
  const historicalDutyEvents = input.historicalDutyEvents.length === 0
    ? freeze([] as DutyEvent[])
    : validateDutyEventHistory(input.historicalDutyEvents, {
        expectedEndAt: departureState.departureAt,
      });
  const dutyEvents = input.dutyEvents.length === 0
    ? freeze([] as DutyEvent[])
    : validateDutyEventHistory(input.dutyEvents, {
        expectedStartAt: departureState.departureAt,
      });
  if (
    input.selectedSleeperPairId !== undefined
    && input.selectedSleeperPairId.trim() === ''
  ) {
    throw new HosAdvancedValidationError([freeze({
      code: 'INVALID_SELECTED_PAIR_ID',
      path: 'selectedSleeperPairId',
      message: 'A selected sleeper pair identifier may not be blank.',
    })]);
  }
  const selections = freeze([...(input.unsupportedSpecialRuleSelections ?? [])]);
  validateUnsupportedSelections(selections);
  validateCoreComposition(departureState, dutyEvents, input.coreResult);

  const sleeper = evaluateSleeper(
    departureState,
    historicalDutyEvents,
    dutyEvents,
    input.selectedSleeperPairId,
  );
  const adverseDrivingCondition = evaluateAdverse(
    input.adverseDrivingCondition,
    input.coreResult,
  );
  const carrierPolicy = evaluateCarrierPolicy(
    departureState,
    dutyEvents,
    input.coreResult,
    sleeper.appliedPair,
  );
  const warnings = unsupportedWarnings(selections);
  const selectedPairRejected = input.selectedSleeperPairId !== undefined
    && sleeper.appliedPair === undefined;
  const adverseRejected = input.adverseDrivingCondition !== undefined
    && adverseDrivingCondition.status !== 'APPLIED';
  const clockAlterationBlocked = selectedPairRejected
    || adverseRejected
    || warnings.length > 0;

  return freeze({
    ruleSet: STANDARD_PROPERTY_CARRYING_ADVANCED_HOS_RULES,
    sleeper,
    adverseDrivingCondition,
    carrierPolicy,
    unsupportedRuleWarnings: warnings,
    clockAlterationBlocked,
    reasons: freeze([
      'Sleeper clocks were altered only for an explicitly selected pair that satisfied both period minimums, the ten-hour total, the sleeper requirement, complete duty-history evidence, and the 11-hour and 14-hour recalculation checks.',
      'Adverse driving conditions were never inferred from weather or traffic; an extension required explicit facts, source, confidence, and a boundary timestamp and never changed cycle or interruption rules.',
      'Carrier driving and duty caps were applied as separate constraints and never raised a federal maximum.',
      'Preferred nightly rest conflicts were reported as policy conflicts rather than federal violations.',
      'Unsupported exceptions, exemptions, declarations, pilot programs, and personal conveyance produced blocking warnings and no clock alteration.',
    ]),
  });
}
