import { describe, expect, it } from 'vitest';

import {
  calculateHosAdvancedRules,
} from '../src/hos-advanced.js';
import type {
  HosAdvancedCalculationInput,
  HosAdverseDrivingConditionSelection,
} from '../src/hos-advanced.js';
import { calculateHosCore } from '../src/hos-core.js';
import {
  HosValidationError,
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '../src/hos.js';
import { utcInstant } from '../src/time.js';
import { durationInMinutes } from '../src/units.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
  HosDutyStatus,
  SleeperCandidateRole,
} from '../src/hos.js';

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'stage 07 test fixture',
  explanation: 'Test-only input.',
});

const provenance = Object.freeze({
  driver: unverifiedUser,
  departure: unverifiedUser,
  dutyStatus: unverifiedUser,
  clocks: unverifiedUser,
  dutyHistory: unverifiedUser,
  sleeper: unverifiedUser,
  carrierPolicy: unverifiedUser,
  restPreference: unverifiedUser,
});

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function priorDays(departureAt: string): readonly unknown[] {
  const date = departureAt.slice(0, 10);
  return Array.from({ length: 8 }, (_, index) => ({
    date: addDays(date, index - 8),
    onDutyTime: { value: 0, unit: 'minute' },
  }));
}

function departureState(
  overrides: Readonly<Record<string, unknown>> = {},
): DriverHosDepartureState {
  const departureAt = typeof overrides.departureAt === 'string'
    ? overrides.departureAt
    : '2026-07-20T00:00:00.000Z';
  return validateDriverHosDepartureState({
    driver: { id: 'driver-stage-07', nameOrIdentifier: 'Driver Stage 07' },
    departureAt,
    departureTimeZone: 'UTC',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: departureAt,
    drivingTimeRemaining: { value: 660, unit: 'minute' },
    shiftTimeRemaining: { value: 840, unit: 'minute' },
    cycleTimeRemaining: { value: 4200, unit: 'minute' },
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 0, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: priorDays(departureAt),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [],
    splitSleeperEnabled: true,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 660, unit: 'minute' },
    carrierMaxDuty: { value: 840, unit: 'minute' },
    provenance,
    ...overrides,
  });
}

interface EventOptions {
  readonly id: string;
  readonly startAt: string;
  readonly minutes: number;
  readonly dutyStatus: HosDutyStatus;
  readonly pairId?: string;
  readonly candidateRole?: SleeperCandidateRole;
}

function event(options: EventOptions): DutyEvent {
  const endAt = new Date(
    Date.parse(options.startAt) + options.minutes * 60_000,
  ).toISOString();
  const driving = options.dutyStatus === 'DRIVING';
  const onDuty = driving || options.dutyStatus === 'ON_DUTY_NOT_DRIVING';
  const participates = options.pairId !== undefined
    && options.candidateRole !== undefined;
  return validateDutyEvent({
    id: options.id,
    startAt: options.startAt,
    endAt,
    duration: { value: options.minutes, unit: 'minute' },
    dutyStatus: options.dutyStatus,
    eventType: driving ? 'STATUS_CHANGE' : 'REST',
    location: { description: 'Stage 07 test location', timeZone: 'UTC' },
    source: 'USER_ENTERED',
    explanation: 'Stage 07 deterministic test event.',
    clockEffects: {
      driving: driving ? 'CONSUMES' : 'DOES_NOT_CONSUME',
      shift: options.dutyStatus === 'SLEEPER_BERTH'
        ? 'RULE_DEPENDENT'
        : 'ADVANCES_WINDOW',
      cycle: onDuty ? 'CONSUMES' : 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption: !driving && options.minutes >= 30,
    sleeperPair: participates
      ? {
          participates: true,
          pairId: options.pairId,
          candidateRole: options.candidateRole,
        }
      : { participates: false },
    provenance: unverifiedUser,
  });
}

function evaluate(
  departure: DriverHosDepartureState,
  dutyEvents: readonly DutyEvent[],
  overrides: Partial<Pick<
    HosAdvancedCalculationInput,
    | 'selectedSleeperPairId'
    | 'adverseDrivingCondition'
    | 'unsupportedSpecialRuleSelections'
  >> = {},
): ReturnType<typeof calculateHosAdvancedRules> {
  const coreResult = calculateHosCore({ departureState: departure, dutyEvents });
  return calculateHosAdvancedRules({
    departureState: departure,
    historicalDutyEvents: [],
    dutyEvents,
    coreResult,
    ...overrides,
  });
}

describe('Stage 07 sleeper-pair evaluation', () => {
  it('accepts an explicitly selected 7/3 pair and recalculates from the end of the first period', () => {
    const departure = departureState();
    const dutyEvents = [
      event({
        id: 'drive-before-short',
        startAt: departure.departureAt,
        minutes: 240,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'short-three-off-duty',
        startAt: '2026-07-20T04:00:00.000Z',
        minutes: 180,
        dutyStatus: 'OFF_DUTY',
        pairId: 'pair-7-3',
        candidateRole: 'SHORT_PERIOD',
      }),
      event({
        id: 'drive-between-pair',
        startAt: '2026-07-20T07:00:00.000Z',
        minutes: 300,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'long-seven-sleeper',
        startAt: '2026-07-20T12:00:00.000Z',
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'pair-7-3',
        candidateRole: 'LONG_PERIOD',
      }),
    ];
    const result = evaluate(departure, dutyEvents, {
      selectedSleeperPairId: 'pair-7-3',
    });

    expect(result.sleeper.appliedPair?.status).toBe(
      'VALID_SELECTED_AND_APPLIED',
    );
    expect(result.sleeper.appliedPair?.periods.map((period) => period.id)).toEqual([
      'short-three-off-duty',
      'long-seven-sleeper',
    ]);
    expect(
      result.sleeper.appliedPair?.recalculation?.drivingTimeRemaining.value,
    ).toBe(360);
    expect(
      result.sleeper.appliedPair?.recalculation?.shiftTimeRemaining.value,
    ).toBe(540);
    expect(result.sleeper.appliedPair?.recalculation?.cycleEffect).toBe(
      'UNCHANGED',
    );
  });

  it('accepts an 8/2 pair and preserves the exact pair identity', () => {
    const departure = departureState();
    const dutyEvents = [
      event({
        id: 'drive-before-long',
        startAt: departure.departureAt,
        minutes: 120,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'long-eight-sleeper',
        startAt: '2026-07-20T02:00:00.000Z',
        minutes: 480,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'pair-8-2',
        candidateRole: 'LONG_PERIOD',
      }),
      event({
        id: 'drive-after-long',
        startAt: '2026-07-20T10:00:00.000Z',
        minutes: 180,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'short-two-off-duty',
        startAt: '2026-07-20T13:00:00.000Z',
        minutes: 120,
        dutyStatus: 'OFF_DUTY',
        pairId: 'pair-8-2',
        candidateRole: 'SHORT_PERIOD',
      }),
    ];
    const result = evaluate(departure, dutyEvents, {
      selectedSleeperPairId: 'pair-8-2',
    });

    expect(result.sleeper.appliedPair?.pairId).toBe('pair-8-2');
    expect(
      result.sleeper.appliedPair?.recalculation?.drivingTimeRemaining.value,
    ).toBe(480);
    expect(
      result.sleeper.appliedPair?.recalculation?.shiftTimeRemaining.value,
    ).toBe(660);
  });

  it('keeps a valid pair and an invalid nine-hour pair distinguishable', () => {
    const departure = departureState();
    const dutyEvents = [
      event({
        id: 'valid-drive-one',
        startAt: departure.departureAt,
        minutes: 60,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'valid-short-three',
        startAt: '2026-07-20T01:00:00.000Z',
        minutes: 180,
        dutyStatus: 'OFF_DUTY',
        pairId: 'valid-pair',
        candidateRole: 'SHORT_PERIOD',
      }),
      event({
        id: 'valid-drive-two',
        startAt: '2026-07-20T04:00:00.000Z',
        minutes: 60,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'valid-long-seven',
        startAt: '2026-07-20T05:00:00.000Z',
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'valid-pair',
        candidateRole: 'LONG_PERIOD',
      }),
      event({
        id: 'bad-drive-one',
        startAt: '2026-07-20T12:00:00.000Z',
        minutes: 60,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'bad-short-two',
        startAt: '2026-07-20T13:00:00.000Z',
        minutes: 120,
        dutyStatus: 'OFF_DUTY',
        pairId: 'invalid-pair',
        candidateRole: 'SHORT_PERIOD',
      }),
      event({
        id: 'bad-drive-two',
        startAt: '2026-07-20T15:00:00.000Z',
        minutes: 60,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'bad-long-seven',
        startAt: '2026-07-20T16:00:00.000Z',
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'invalid-pair',
        candidateRole: 'LONG_PERIOD',
      }),
    ];
    const result = evaluate(departure, dutyEvents, {
      selectedSleeperPairId: 'valid-pair',
    });
    const valid = result.sleeper.pairs.find((pair) => pair.pairId === 'valid-pair');
    const invalid = result.sleeper.pairs.find((pair) => pair.pairId === 'invalid-pair');

    expect(valid?.status).toBe('VALID_SELECTED_AND_APPLIED');
    expect(invalid?.status).toBe('INVALID');
    expect(invalid?.issues.map((issue) => issue.code)).toContain(
      'PAIR_TOTAL_SHORTER_THAN_TEN_HOURS',
    );
  });

  it('does not apply a qualifying pair unless split sleeper is enabled and selected', () => {
    const departure = departureState({ splitSleeperEnabled: false });
    const dutyEvents = [
      event({
        id: 'short-three-disabled',
        startAt: departure.departureAt,
        minutes: 180,
        dutyStatus: 'OFF_DUTY',
        pairId: 'disabled-pair',
        candidateRole: 'SHORT_PERIOD',
      }),
      event({
        id: 'drive-disabled',
        startAt: '2026-07-20T03:00:00.000Z',
        minutes: 60,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'long-seven-disabled',
        startAt: '2026-07-20T04:00:00.000Z',
        minutes: 420,
        dutyStatus: 'SLEEPER_BERTH',
        pairId: 'disabled-pair',
        candidateRole: 'LONG_PERIOD',
      }),
    ];
    const result = evaluate(departure, dutyEvents, {
      selectedSleeperPairId: 'disabled-pair',
    });

    expect(result.sleeper.appliedPair).toBeUndefined();
    expect(result.clockAlterationBlocked).toBe(true);
    expect(result.sleeper.pairs[0]?.issues.map((issue) => issue.code)).toContain(
      'SPLIT_SLEEPER_NOT_ENABLED',
    );
  });

  it('allows off-duty only for the short paired period', () => {
    expect(event({
      id: 'short-off-duty-valid',
      startAt: '2026-07-20T00:00:00.000Z',
      minutes: 120,
      dutyStatus: 'OFF_DUTY',
      pairId: 'pair-role-validation',
      candidateRole: 'SHORT_PERIOD',
    }).dutyStatus).toBe('OFF_DUTY');

    expect(() => event({
      id: 'long-off-duty-invalid',
      startAt: '2026-07-20T02:00:00.000Z',
      minutes: 420,
      dutyStatus: 'OFF_DUTY',
      pairId: 'pair-role-validation',
      candidateRole: 'LONG_PERIOD',
    })).toThrow(HosValidationError);
  });
});

describe('Stage 07 adverse-driving-condition selection', () => {
  function adverseSelection(
    minutes: number,
  ): HosAdverseDrivingConditionSelection {
    return {
      id: `adverse-${String(minutes)}`,
      encounteredAt: utcInstant('2026-07-20T00:00:00.000Z'),
      conditionType: 'SNOW',
      description: 'Unexpected snow developed after dispatch.',
      requestedExtension: durationInMinutes(minutes),
      purpose: 'REACH_SAFE_PLACE',
      normalRunWasLegallyCompletable: true,
      driverCouldNotReasonablyKnowBeforeDutyOrQualifyingRest: true,
      carrierCouldNotReasonablyKnowBeforeDispatch: true,
      conditionPreventedSafeCompletionWithinNormalLimits: true,
      source: 'Driver report and timestamped dispatch record',
      confidence: 'SUPPORTED',
      explanation: 'The documented condition was not reasonably knowable before dispatch.',
    };
  }

  it('applies exactly two additional hours only after explicit supported selection', () => {
    const departure = departureState();
    const result = evaluate(departure, [], {
      adverseDrivingCondition: adverseSelection(120),
    });

    expect(result.adverseDrivingCondition.status).toBe('APPLIED');
    expect(
      result.adverseDrivingCondition.extendedDrivingTimeRemainingAtSelection?.value,
    ).toBe(780);
    expect(
      result.adverseDrivingCondition.extendedShiftTimeRemainingAtSelection?.value,
    ).toBe(960);
    expect(result.adverseDrivingCondition.cycleEffect).toBe('UNCHANGED');
    expect(result.adverseDrivingCondition.interruptionEffect).toBe('UNCHANGED');
  });

  it('rejects a 121-minute extension and leaves adverse mode disabled when not selected', () => {
    const departure = departureState();
    const rejected = evaluate(departure, [], {
      adverseDrivingCondition: adverseSelection(121),
    });
    const disabled = evaluate(departure, []);

    expect(rejected.adverseDrivingCondition.status).toBe('REJECTED');
    expect(rejected.adverseDrivingCondition.issues.map((issue) => issue.code)).toContain(
      'EXTENSION_EXCEEDS_TWO_HOURS',
    );
    expect(disabled.adverseDrivingCondition.status).toBe('NOT_SELECTED');
  });

  it('does not use adverse mode to restore cycle availability or waive an interruption', () => {
    const departure = departureState({
      cycleTimeRemaining: { value: 0, unit: 'minute' },
    });
    const result = evaluate(departure, [], {
      adverseDrivingCondition: adverseSelection(120),
    });

    expect(result.adverseDrivingCondition.status).toBe('REJECTED');
    expect(result.adverseDrivingCondition.issues.map((issue) => issue.code)).toContain(
      'BLOCKED_BY_UNEXTENDED_RULE',
    );
  });
});

describe('Stage 07 carrier policy and unsupported selections', () => {
  it('enforces separate stricter carrier driving and duty caps at exact timestamps', () => {
    const departure = departureState({
      splitSleeperEnabled: false,
      carrierMaxDailyDriving: { value: 600, unit: 'minute' },
      carrierMaxDuty: { value: 720, unit: 'minute' },
    });
    const dutyEvents = [
      event({
        id: 'carrier-drive-600',
        startAt: departure.departureAt,
        minutes: 600,
        dutyStatus: 'DRIVING',
      }),
      event({
        id: 'carrier-break-30',
        startAt: '2026-07-20T10:00:00.000Z',
        minutes: 30,
        dutyStatus: 'OFF_DUTY',
      }),
      event({
        id: 'carrier-duty-121',
        startAt: '2026-07-20T10:30:00.000Z',
        minutes: 121,
        dutyStatus: 'ON_DUTY_NOT_DRIVING',
      }),
    ];
    const result = evaluate(departure, dutyEvents);
    const dutyViolation = result.carrierPolicy.violations.find(
      (violation) => violation.code === 'CARRIER_DUTY_CAP_EXCEEDED',
    );

    expect(result.carrierPolicy.drivingPolicyIsStricterThanFederalStandard).toBe(true);
    expect(result.carrierPolicy.dutyPolicyIsStricterThanFederalStandard).toBe(true);
    expect(result.carrierPolicy.violations.some(
      (violation) => violation.code === 'CARRIER_DRIVING_CAP_EXCEEDED',
    )).toBe(false);
    expect(dutyViolation?.occurredAt).toBe('2026-07-20T12:30:00.000Z');
    expect(dutyViolation?.prohibitedTime.value).toBe(1);
    expect(result.carrierPolicy.canPerformCarrierAuthorizedDriving).toBe(false);
  });

  it('reports preferred nightly-rest conflicts as policy, not federal legality', () => {
    const departure = departureState({
      departureAt: '2026-07-20T20:00:00.000Z',
      currentDutyStatusStartedAt: '2026-07-20T20:00:00.000Z',
      splitSleeperEnabled: false,
      nightlyRestPreference: {
        startLocalTime: '21:00',
        endLocalTime: '06:00',
        timeZone: 'UTC',
      },
    });
    const result = evaluate(departure, [event({
      id: 'preferred-rest-conflict',
      startAt: departure.departureAt,
      minutes: 120,
      dutyStatus: 'DRIVING',
    })]);

    expect(result.carrierPolicy.preferredRestWindow.status).toBe('CONFLICT');
    expect(
      result.carrierPolicy.preferredRestWindow.conflicts[0]?.firstConflictAt,
    ).toBe('2026-07-20T21:00:00.000Z');
    expect(
      result.carrierPolicy.preferredRestWindow.conflicts[0]?.conflictingTime.value,
    ).toBe(60);
  });

  it('blocks unsupported personal conveyance and pilot selections without changing clocks', () => {
    const departure = departureState({ splitSleeperEnabled: false });
    const result = evaluate(departure, [], {
      unsupportedSpecialRuleSelections: [
        {
          rule: 'PERSONAL_CONVEYANCE',
          source: 'User request',
          explanation: 'The user asked to classify future movement as personal conveyance.',
        },
        {
          rule: 'FLEXIBLE_SLEEPER_BERTH_PILOT',
          source: 'Pilot enrollment claim',
          explanation: 'No verified pilot enrollment or applicable rule module is available.',
        },
      ],
    });

    expect(result.unsupportedRuleWarnings).toHaveLength(2);
    expect(result.unsupportedRuleWarnings.every(
      (warning) => warning.severity === 'BLOCKING',
    )).toBe(true);
    expect(result.clockAlterationBlocked).toBe(true);
    expect(result.adverseDrivingCondition.status).toBe('NOT_SELECTED');
  });
});
