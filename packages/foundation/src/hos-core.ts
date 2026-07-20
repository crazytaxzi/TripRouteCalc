import {
  validateDriverHosDepartureState,
  validateDutyEventHistory,
} from './hos.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
} from './hos.js';
import { utcInstant } from './time.js';
import type { UtcInstant } from './time.js';
import { durationInMinutes } from './units.js';
import type { Duration } from './units.js';

export const STANDARD_PROPERTY_CARRYING_HOS_RULES = Object.freeze({
  id: 'US_FEDERAL_PROPERTY_CARRYING_STANDARD' as const,
  revision: 'stage-05-v1' as const,
  drivingLimitMinutes: 11 * 60,
  shiftWindowMinutes: 14 * 60,
  interruptionThresholdMinutes: 8 * 60,
  interruptionDurationMinutes: 30,
  resetDurationMinutes: 10 * 60,
  interruptionEligibleStatuses: Object.freeze([
    'OFF_DUTY',
    'SLEEPER_BERTH',
    'ON_DUTY_NOT_DRIVING',
  ] as const),
  resetEligibleStatuses: Object.freeze([
    'OFF_DUTY',
    'SLEEPER_BERTH',
  ] as const),
});

export type HosCoreBlockingReasonCode =
  | 'DRIVING_LIMIT_REACHED'
  | 'SHIFT_WINDOW_EXPIRED'
  | 'CYCLE_LIMIT_REACHED'
  | 'THIRTY_MINUTE_INTERRUPTION_REQUIRED';

export interface HosCoreBlockingReason {
  readonly code: HosCoreBlockingReasonCode;
  readonly explanation: string;
}

export type HosCoreViolationCode =
  | 'DRIVING_LIMIT_EXCEEDED'
  | 'SHIFT_WINDOW_EXCEEDED'
  | 'CYCLE_LIMIT_EXCEEDED'
  | 'THIRTY_MINUTE_INTERRUPTION_VIOLATION';

export interface HosCoreViolation {
  readonly code: HosCoreViolationCode;
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly prohibitedDrivingTime: Duration;
  readonly explanation: string;
}

export type HosCoreNextActionCode =
  | 'NONE'
  | 'TAKE_THIRTY_MINUTE_INTERRUPTION'
  | 'TAKE_TEN_CONSECUTIVE_HOURS_OFF_DUTY'
  | 'WAIT_FOR_CYCLE_AVAILABILITY';

export interface HosCoreNextAction {
  readonly code: HosCoreNextActionCode;
  readonly minimumDuration?: Duration;
  readonly explanation: string;
}

export interface HosCoreClockSnapshot {
  readonly at: UtcInstant;
  readonly currentDutyStatus: HosDutyStatus;
  readonly drivingTimeRemaining: Duration;
  readonly shiftTimeRemaining: Duration;
  readonly cycleTimeRemaining: Duration;
  readonly drivenSinceLastQualifyingInterruption: Duration;
  readonly onDutyTimeCurrentShift: Duration;
  readonly consecutiveNonDrivingTime: Duration;
  readonly consecutiveResetQualifyingTime: Duration;
  readonly shiftWindowActive: boolean;
  readonly canDrive: boolean;
  readonly blockingReasons: readonly HosCoreBlockingReason[];
}

export interface HosCoreTransitionMilestones {
  readonly qualifyingInterruptionCompletedAt?: UtcInstant;
  readonly tenHourResetCompletedAt?: UtcInstant;
}

export interface HosCoreTransition {
  readonly event: DutyEvent;
  readonly before: HosCoreClockSnapshot;
  readonly after: HosCoreClockSnapshot;
  readonly legalDrivingTime: Duration;
  readonly prohibitedDrivingTime: Duration;
  readonly violations: readonly HosCoreViolation[];
  readonly milestones: HosCoreTransitionMilestones;
  readonly reasons: readonly string[];
}

export interface HosCoreCalculationInput {
  readonly departureState: DriverHosDepartureState;
  readonly dutyEvents: readonly DutyEvent[];
}

export interface HosCoreCalculationResult {
  readonly ruleSet: typeof STANDARD_PROPERTY_CARRYING_HOS_RULES;
  readonly initial: HosCoreClockSnapshot;
  readonly transitions: readonly HosCoreTransition[];
  readonly final: HosCoreClockSnapshot;
  readonly violations: readonly HosCoreViolation[];
  readonly nextRequiredAction: HosCoreNextAction;
  readonly reasons: readonly string[];
}

interface MutableHosCoreState {
  at: UtcInstant;
  currentDutyStatus: HosDutyStatus;
  drivingMinutesRemaining: number;
  shiftMinutesRemaining: number;
  cycleMinutesRemaining: number;
  drivenMinutesSinceInterruption: number;
  onDutyMinutesCurrentShift: number;
  consecutiveNonDrivingMinutes: number;
  consecutiveResetQualifyingMinutes: number;
  interruptionSatisfiedInCurrentStreak: boolean;
  resetSatisfiedInCurrentStreak: boolean;
  shiftWindowActive: boolean;
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function addMinutes(instant: UtcInstant, minutes: number): UtcInstant {
  return utcInstant(new Date(Date.parse(instant) + minutes * 60_000).toISOString());
}

function duration(minutes: number): Duration {
  return durationInMinutes(Math.max(0, minutes));
}

function isInterruptionEligible(status: HosDutyStatus): boolean {
  return status !== 'DRIVING';
}

function blockingReasons(state: MutableHosCoreState): readonly HosCoreBlockingReason[] {
  const reasons: HosCoreBlockingReason[] = [];
  if (state.drivingMinutesRemaining <= 0) {
    reasons.push(freeze({
      code: 'DRIVING_LIMIT_REACHED',
      explanation: 'The available 11-hour driving allowance is exhausted.',
    }));
  }
  if (state.shiftMinutesRemaining <= 0) {
    reasons.push(freeze({
      code: 'SHIFT_WINDOW_EXPIRED',
      explanation: 'The 14-consecutive-hour driving window has expired.',
    }));
  }
  if (state.cycleMinutesRemaining <= 0) {
    reasons.push(freeze({
      code: 'CYCLE_LIMIT_REACHED',
      explanation: 'No current cycle time remains for additional on-duty work.',
    }));
  }
  if (
    state.drivenMinutesSinceInterruption >=
    STANDARD_PROPERTY_CARRYING_HOS_RULES.interruptionThresholdMinutes
  ) {
    reasons.push(freeze({
      code: 'THIRTY_MINUTE_INTERRUPTION_REQUIRED',
      explanation: 'Eight cumulative driving hours have elapsed without a qualifying 30-minute non-driving interruption.',
    }));
  }
  return freeze(reasons);
}

function snapshot(state: MutableHosCoreState): HosCoreClockSnapshot {
  const reasons = blockingReasons(state);
  return freeze({
    at: state.at,
    currentDutyStatus: state.currentDutyStatus,
    drivingTimeRemaining: duration(state.drivingMinutesRemaining),
    shiftTimeRemaining: duration(state.shiftMinutesRemaining),
    cycleTimeRemaining: duration(state.cycleMinutesRemaining),
    drivenSinceLastQualifyingInterruption: duration(
      state.drivenMinutesSinceInterruption,
    ),
    onDutyTimeCurrentShift: duration(state.onDutyMinutesCurrentShift),
    consecutiveNonDrivingTime: duration(state.consecutiveNonDrivingMinutes),
    consecutiveResetQualifyingTime: duration(
      state.consecutiveResetQualifyingMinutes,
    ),
    shiftWindowActive: state.shiftWindowActive,
    canDrive: reasons.length === 0,
    blockingReasons: reasons,
  });
}

function nextRequiredAction(state: MutableHosCoreState): HosCoreNextAction {
  if (state.cycleMinutesRemaining <= 0) {
    return freeze({
      code: 'WAIT_FOR_CYCLE_AVAILABILITY',
      explanation: 'Cycle availability is zero. Stage 06 recap and restart logic must determine when cycle time becomes available.',
    });
  }
  if (state.drivingMinutesRemaining <= 0 || state.shiftMinutesRemaining <= 0) {
    return freeze({
      code: 'TAKE_TEN_CONSECUTIVE_HOURS_OFF_DUTY',
      minimumDuration: duration(
        STANDARD_PROPERTY_CARRYING_HOS_RULES.resetDurationMinutes,
      ),
      explanation: 'A qualifying 10-consecutive-hour off-duty period is required before a fresh 11-hour allowance and 14-hour window can begin.',
    });
  }
  if (
    state.drivenMinutesSinceInterruption >=
    STANDARD_PROPERTY_CARRYING_HOS_RULES.interruptionThresholdMinutes
  ) {
    return freeze({
      code: 'TAKE_THIRTY_MINUTE_INTERRUPTION',
      minimumDuration: duration(
        STANDARD_PROPERTY_CARRYING_HOS_RULES.interruptionDurationMinutes,
      ),
      explanation: 'Complete at least 30 consecutive non-driving minutes before additional driving.',
    });
  }
  return freeze({
    code: 'NONE',
    explanation: 'No core HOS interruption or rest action is currently required.',
  });
}

function initialMutableState(
  departureState: DriverHosDepartureState,
): MutableHosCoreState {
  const shiftWindowActive =
    departureState.currentDutyStatus === 'DRIVING' ||
    departureState.currentDutyStatus === 'ON_DUTY_NOT_DRIVING' ||
    departureState.shiftTimeRemaining.value <
      STANDARD_PROPERTY_CARRYING_HOS_RULES.shiftWindowMinutes ||
    departureState.onDutyTimeCurrentShift.value > 0;

  return {
    at: departureState.departureAt,
    currentDutyStatus: departureState.currentDutyStatus,
    drivingMinutesRemaining: departureState.drivingTimeRemaining.value,
    shiftMinutesRemaining: departureState.shiftTimeRemaining.value,
    cycleMinutesRemaining: departureState.cycleTimeRemaining.value,
    drivenMinutesSinceInterruption:
      departureState.drivenSinceLastQualifyingInterruption.value,
    onDutyMinutesCurrentShift: departureState.onDutyTimeCurrentShift.value,
    consecutiveNonDrivingMinutes: 0,
    consecutiveResetQualifyingMinutes: 0,
    interruptionSatisfiedInCurrentStreak: false,
    resetSatisfiedInCurrentStreak: false,
    shiftWindowActive,
  };
}

function activateShiftWindow(state: MutableHosCoreState): void {
  if (state.shiftWindowActive) return;
  state.shiftWindowActive = true;
  state.shiftMinutesRemaining =
    STANDARD_PROPERTY_CARRYING_HOS_RULES.shiftWindowMinutes;
}

function violation(
  code: HosCoreViolationCode,
  event: DutyEvent,
  availableMinutes: number,
  explanation: string,
): HosCoreViolation {
  return freeze({
    code,
    eventId: event.id,
    occurredAt: addMinutes(event.startAt, Math.max(0, availableMinutes)),
    prohibitedDrivingTime: duration(
      Math.max(0, event.duration.value - Math.max(0, availableMinutes)),
    ),
    explanation,
  });
}

function processDrivingEvent(
  state: MutableHosCoreState,
  event: DutyEvent,
): {
  readonly legalDrivingMinutes: number;
  readonly violations: readonly HosCoreViolation[];
  readonly reasons: readonly string[];
} {
  activateShiftWindow(state);
  state.consecutiveNonDrivingMinutes = 0;
  state.consecutiveResetQualifyingMinutes = 0;
  state.interruptionSatisfiedInCurrentStreak = false;
  state.resetSatisfiedInCurrentStreak = false;

  const interruptionMinutesRemaining = Math.max(
    0,
    STANDARD_PROPERTY_CARRYING_HOS_RULES.interruptionThresholdMinutes -
      state.drivenMinutesSinceInterruption,
  );
  const availableLegalMinutes = Math.min(
    state.drivingMinutesRemaining,
    state.shiftMinutesRemaining,
    state.cycleMinutesRemaining,
    interruptionMinutesRemaining,
  );
  const legalDrivingMinutes = Math.min(
    event.duration.value,
    Math.max(0, availableLegalMinutes),
  );
  const violations: HosCoreViolation[] = [];

  if (event.duration.value > state.drivingMinutesRemaining) {
    violations.push(violation(
      'DRIVING_LIMIT_EXCEEDED',
      event,
      state.drivingMinutesRemaining,
      'Driving continued beyond the available 11-hour driving allowance.',
    ));
  }
  if (event.duration.value > state.shiftMinutesRemaining) {
    violations.push(violation(
      'SHIFT_WINDOW_EXCEEDED',
      event,
      state.shiftMinutesRemaining,
      'Driving continued beyond the available 14-consecutive-hour window.',
    ));
  }
  if (event.duration.value > state.cycleMinutesRemaining) {
    violations.push(violation(
      'CYCLE_LIMIT_EXCEEDED',
      event,
      state.cycleMinutesRemaining,
      'Driving continued after current cycle availability reached zero.',
    ));
  }
  if (event.duration.value > interruptionMinutesRemaining) {
    violations.push(violation(
      'THIRTY_MINUTE_INTERRUPTION_VIOLATION',
      event,
      interruptionMinutesRemaining,
      'Driving continued after eight cumulative driving hours without a qualifying 30-minute non-driving interruption.',
    ));
  }

  state.drivingMinutesRemaining = Math.max(
    0,
    state.drivingMinutesRemaining - event.duration.value,
  );
  state.shiftMinutesRemaining = Math.max(
    0,
    state.shiftMinutesRemaining - event.duration.value,
  );
  state.cycleMinutesRemaining = Math.max(
    0,
    state.cycleMinutesRemaining - event.duration.value,
  );
  state.drivenMinutesSinceInterruption += event.duration.value;
  state.onDutyMinutesCurrentShift += event.duration.value;

  return freeze({
    legalDrivingMinutes,
    violations: freeze(violations),
    reasons: freeze([
      `Driving consumed ${String(event.duration.value)} minute(s) from the driving, shift, and cycle clocks.`,
      legalDrivingMinutes === event.duration.value
        ? 'The complete driving event remained within all core legal clocks.'
        : `Only ${String(legalDrivingMinutes)} minute(s) of the driving event remained within every core legal constraint.`,
    ]),
  });
}

function processOnDutyNotDrivingEvent(
  state: MutableHosCoreState,
  event: DutyEvent,
): readonly string[] {
  activateShiftWindow(state);
  state.shiftMinutesRemaining = Math.max(
    0,
    state.shiftMinutesRemaining - event.duration.value,
  );
  state.cycleMinutesRemaining = Math.max(
    0,
    state.cycleMinutesRemaining - event.duration.value,
  );
  state.onDutyMinutesCurrentShift += event.duration.value;
  state.consecutiveResetQualifyingMinutes = 0;
  state.resetSatisfiedInCurrentStreak = false;

  return freeze([
    `On-duty-not-driving time advanced the shift window and consumed ${String(event.duration.value)} cycle minute(s).`,
  ]);
}

function processResetEligibleEvent(
  state: MutableHosCoreState,
  event: DutyEvent,
): {
  readonly tenHourResetCompletedAt?: UtcInstant;
  readonly reasons: readonly string[];
} {
  const previousResetMinutes = state.consecutiveResetQualifyingMinutes;
  const resetMinutesNeeded = Math.max(
    0,
    STANDARD_PROPERTY_CARRYING_HOS_RULES.resetDurationMinutes -
      previousResetMinutes,
  );
  const resetCompletes =
    !state.resetSatisfiedInCurrentStreak &&
    event.duration.value >= resetMinutesNeeded;
  const minutesBeforeReset = resetCompletes
    ? resetMinutesNeeded
    : event.duration.value;

  if (state.shiftWindowActive) {
    state.shiftMinutesRemaining = Math.max(
      0,
      state.shiftMinutesRemaining - minutesBeforeReset,
    );
  }

  state.consecutiveResetQualifyingMinutes += event.duration.value;

  if (!resetCompletes) {
    return freeze({
      reasons: freeze([
        `The ${event.dutyStatus.toLowerCase().replaceAll('_', ' ')} event advanced an active 14-hour window but did not consume cycle time.`,
      ]),
    });
  }

  const completedAt = addMinutes(event.startAt, resetMinutesNeeded);
  state.drivingMinutesRemaining =
    STANDARD_PROPERTY_CARRYING_HOS_RULES.drivingLimitMinutes;
  state.shiftMinutesRemaining =
    STANDARD_PROPERTY_CARRYING_HOS_RULES.shiftWindowMinutes;
  state.drivenMinutesSinceInterruption = 0;
  state.onDutyMinutesCurrentShift = 0;
  state.shiftWindowActive = false;
  state.resetSatisfiedInCurrentStreak = true;
  state.interruptionSatisfiedInCurrentStreak = true;

  return freeze({
    tenHourResetCompletedAt: completedAt,
    reasons: freeze([
      `Ten consecutive hours of off-duty or sleeper-berth time completed at ${completedAt}.`,
      'The driving allowance and 14-hour window reset; cycle time did not reset.',
    ]),
  });
}

function applyInterruptionStreak(
  state: MutableHosCoreState,
  event: DutyEvent,
): UtcInstant | undefined {
  if (!isInterruptionEligible(event.dutyStatus)) {
    state.consecutiveNonDrivingMinutes = 0;
    state.interruptionSatisfiedInCurrentStreak = false;
    return undefined;
  }

  const previousMinutes = state.consecutiveNonDrivingMinutes;
  state.consecutiveNonDrivingMinutes += event.duration.value;
  if (state.interruptionSatisfiedInCurrentStreak) return undefined;

  const minutesNeeded = Math.max(
    0,
    STANDARD_PROPERTY_CARRYING_HOS_RULES.interruptionDurationMinutes -
      previousMinutes,
  );
  if (event.duration.value < minutesNeeded) return undefined;

  const completedAt = addMinutes(event.startAt, minutesNeeded);
  state.drivenMinutesSinceInterruption = 0;
  state.interruptionSatisfiedInCurrentStreak = true;
  return completedAt;
}

function processEvent(
  state: MutableHosCoreState,
  event: DutyEvent,
): HosCoreTransition {
  const before = snapshot(state);
  const transitionViolations: HosCoreViolation[] = [];
  const reasons: string[] = [];
  let legalDrivingMinutes = 0;
  let tenHourResetCompletedAt: UtcInstant | undefined;
  const qualifyingInterruptionCompletedAt = isInterruptionEligible(
    event.dutyStatus,
  )
    ? applyInterruptionStreak(state, event)
    : undefined;

  switch (event.dutyStatus) {
    case 'DRIVING': {
      const result = processDrivingEvent(state, event);
      legalDrivingMinutes = result.legalDrivingMinutes;
      transitionViolations.push(...result.violations);
      reasons.push(...result.reasons);
      break;
    }
    case 'ON_DUTY_NOT_DRIVING':
      reasons.push(...processOnDutyNotDrivingEvent(state, event));
      break;
    case 'OFF_DUTY':
    case 'SLEEPER_BERTH': {
      const result = processResetEligibleEvent(state, event);
      tenHourResetCompletedAt = result.tenHourResetCompletedAt;
      reasons.push(...result.reasons);
      break;
    }
  }

  if (qualifyingInterruptionCompletedAt !== undefined) {
    reasons.push(
      `A qualifying 30-minute non-driving interruption completed at ${qualifyingInterruptionCompletedAt}.`,
    );
  }

  state.at = event.endAt;
  state.currentDutyStatus = event.dutyStatus;
  const after = snapshot(state);
  const prohibitedDrivingMinutes = Math.max(
    0,
    event.duration.value - legalDrivingMinutes,
  );

  return freeze({
    event,
    before,
    after,
    legalDrivingTime: duration(legalDrivingMinutes),
    prohibitedDrivingTime: duration(
      event.dutyStatus === 'DRIVING' ? prohibitedDrivingMinutes : 0,
    ),
    violations: freeze(transitionViolations),
    milestones: freeze({
      ...(qualifyingInterruptionCompletedAt === undefined
        ? {}
        : { qualifyingInterruptionCompletedAt }),
      ...(tenHourResetCompletedAt === undefined
        ? {}
        : { tenHourResetCompletedAt }),
    }),
    reasons: freeze(reasons),
  });
}

export function calculateHosCore(
  input: HosCoreCalculationInput,
): HosCoreCalculationResult {
  const departureState = validateDriverHosDepartureState(input.departureState);
  const dutyEvents = input.dutyEvents.length === 0
    ? freeze([] as DutyEvent[])
    : validateDutyEventHistory(input.dutyEvents, {
        expectedStartAt: departureState.departureAt,
      });
  const state = initialMutableState(departureState);
  const initial = snapshot(state);
  const transitions: HosCoreTransition[] = [];
  const violations: HosCoreViolation[] = [];

  dutyEvents.forEach((event) => {
    const transition = processEvent(state, event);
    transitions.push(transition);
    violations.push(...transition.violations);
  });

  const final = snapshot(state);
  const action = nextRequiredAction(state);
  const reasons = freeze([
    'The engine used integer-minute arithmetic and the validated departure clocks as independent constraints.',
    'Ordinary off-duty, sleeper-berth, waiting, loading, unloading, and fuel events did not pause an active 14-hour window.',
    'Any 30 consecutive non-driving minutes satisfied the standard interruption rule, including combinations of eligible non-driving statuses.',
    'Only 10 consecutive hours composed of off-duty and sleeper-berth time reset the 11-hour allowance and 14-hour window.',
    'Cycle recaps, 34-hour restarts, split sleeper, adverse conditions, personal conveyance, and carrier-policy calculations remain outside Stage 05.',
  ]);

  return freeze({
    ruleSet: STANDARD_PROPERTY_CARRYING_HOS_RULES,
    initial,
    transitions: freeze(transitions),
    final,
    violations: freeze(violations),
    nextRequiredAction: action,
    reasons,
  });
}
