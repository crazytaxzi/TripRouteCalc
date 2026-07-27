import {
  durationInMinutes,
  ianaTimeZone,
  utcInstant,
  validateDriverHosDepartureState,
} from '@trip-route-calc/foundation';
import type {
  DriverHosDepartureState,
  DutyEventSource,
  HosCycleType,
  HosDataProvenance,
  HosDutyStatus,
  IanaTimeZone,
  UtcInstant,
} from '@trip-route-calc/foundation';

import type { PlanTripBody } from './contracts.js';

export interface Stage18HosDriverReference {
  readonly publicId?: string;
  readonly nameOrIdentifier: string;
}

interface Stage18HosSourceMapping {
  readonly provenance: HosDataProvenance;
  readonly sleeperSource: DutyEventSource;
}

const MINUTES_PER_HOUR = 60;
const LONG_SLEEPER_MINUTES = 7 * MINUTES_PER_HOUR;
const MILLISECONDS_PER_MINUTE = 60_000;

function dutyStatus(value: PlanTripBody['currentDutyStatus']): HosDutyStatus {
  switch (value) {
    case 'off_duty':
      return 'OFF_DUTY';
    case 'sleeper_berth':
      return 'SLEEPER_BERTH';
    case 'driving':
      return 'DRIVING';
    case 'on_duty_not_driving':
      return 'ON_DUTY_NOT_DRIVING';
  }
}

function cycleType(value: PlanTripBody['hos']['cycleType']): HosCycleType {
  return value === '60_in_7'
    ? 'SIXTY_HOURS_SEVEN_DAYS'
    : 'SEVENTY_HOURS_EIGHT_DAYS';
}

function cycleDayCount(value: PlanTripBody['hos']['cycleType']): 7 | 8 {
  return value === '60_in_7' ? 7 : 8;
}

function sourceMapping(
  value: PlanTripBody['hos']['provenance'],
): Stage18HosSourceMapping {
  switch (value) {
    case 'user_entered':
      return Object.freeze({
        provenance: Object.freeze({
          origin: 'USER_ENTERED',
          verification: 'UNVERIFIED',
          sourceName: 'Stage 18 trip setup form',
          explanation:
            'The authenticated user entered these HOS facts; they have not been independently verified.',
        }),
        sleeperSource: 'USER_ENTERED',
      });
    case 'imported_eld':
      return Object.freeze({
        provenance: Object.freeze({
          origin: 'PROVIDER_DERIVED',
          verification: 'UNVERIFIED',
          sourceName: 'Imported ELD facts',
          explanation:
            'The browser identified these HOS facts as imported from an ELD, but Stage 18 has not independently verified the provider record.',
        }),
        sleeperSource: 'ELD_PROVIDER',
      });
    case 'carrier_record':
      return Object.freeze({
        provenance: Object.freeze({
          origin: 'PROVIDER_DERIVED',
          verification: 'UNVERIFIED',
          sourceName: 'Carrier record facts',
          explanation:
            'The browser identified these HOS facts as coming from a carrier record, but Stage 18 has not independently verified that record.',
        }),
        sleeperSource: 'CARRIER_SYSTEM',
      });
  }
}

function localDateAt(value: UtcInstant, timeZone: IanaTimeZone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const component = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part): boolean => part.type === type)?.value ?? '';
  return `${component('year')}-${component('month')}-${component('day')}`;
}

function addDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function exactWholeMinutes(startAt: UtcInstant, endAt: UtcInstant): number {
  const milliseconds = Date.parse(endAt) - Date.parse(startAt);
  if (milliseconds <= 0 || milliseconds % MILLISECONDS_PER_MINUTE !== 0) {
    return 0;
  }
  return milliseconds / MILLISECONDS_PER_MINUTE;
}

export function assembleStage18DriverHosDepartureState(
  body: PlanTripBody,
  driver: Stage18HosDriverReference,
): DriverHosDepartureState {
  const departureAt = utcInstant(body.departureAt);
  const departureTimeZone = ianaTimeZone(body.departureTimeZone);
  const mapping = sourceMapping(body.hos.provenance);
  const provenance = Object.freeze({
    driver: mapping.provenance,
    departure: mapping.provenance,
    dutyStatus: mapping.provenance,
    clocks: mapping.provenance,
    dutyHistory: mapping.provenance,
    sleeper: mapping.provenance,
    carrierPolicy: mapping.provenance,
    restPreference: mapping.provenance,
  });
  const selectedCycleDays = cycleDayCount(body.hos.cycleType);

  const candidate = {
    driver: {
      ...(driver.publicId === undefined ? {} : { id: driver.publicId }),
      nameOrIdentifier: driver.nameOrIdentifier,
    },
    departureAt,
    departureTimeZone,
    currentDutyStatus: dutyStatus(body.currentDutyStatus),
    currentDutyStatusStartedAt: utcInstant(body.currentDutyStatusBeganAt),
    drivingTimeRemaining: durationInMinutes(
      body.clocks.driveMinutesRemaining,
    ),
    shiftTimeRemaining: durationInMinutes(body.clocks.shiftMinutesRemaining),
    cycleTimeRemaining: durationInMinutes(body.clocks.cycleMinutesRemaining),
    cycleType: cycleType(body.hos.cycleType),
    drivenSinceLastQualifyingInterruption: durationInMinutes(
      body.hos.drivenSinceQualifyingInterruptionMinutes,
    ),
    onDutyTimeCurrentShift: durationInMinutes(
      body.hos.onDutyCurrentShiftMinutes,
    ),
    offDutyTimeImmediatelyBeforeDeparture: durationInMinutes(
      body.hos.offDutyBeforeDepartureMinutes,
    ),
    qualifyingTenHourBreakCompleted:
      body.hos.qualifyingTenHourBreakCompleted,
    priorDutyDays: body.hos.priorDutyTotals.map((day) => ({
      date: day.date,
      onDutyTime: durationInMinutes(day.onDutyMinutes),
    })),
    recapReturns: body.hos.cycleRecaps.map((recap) => {
      const availableAt = utcInstant(recap.availableAt);
      return {
        sourceDate: addDays(
          localDateAt(availableAt, departureTimeZone),
          -selectedCycleDays,
        ),
        availableAt,
        returnedTime: durationInMinutes(recap.minutesReturning),
      };
    }),
    sleeperBerthEligible: body.hos.sleeperBerthEligible,
    existingSleeperPeriods: body.hos.existingSleeperPeriods.map(
      (period, index) => {
        const startAt = utcInstant(period.startAt);
        const endAt = utcInstant(period.endAt);
        const durationMinutes = exactWholeMinutes(startAt, endAt);
        return {
          id: `stage18-sleeper-${String(index + 1)}`,
          startAt,
          endAt,
          duration: durationInMinutes(durationMinutes),
          candidateRole:
            durationMinutes >= LONG_SLEEPER_MINUTES
              ? ('LONG_PERIOD' as const)
              : ('SHORT_PERIOD' as const),
          source: mapping.sleeperSource,
          explanation:
            'Stage 18 derived the sleeper-period duration and candidate role from the entered timestamps.',
        };
      },
    ),
    splitSleeperEnabled: body.hos.splitSleeperEnabled,
    restart34HourPlanned: body.hos.plannedThirtyFourHourRestart,
    carrierMaxDailyDriving: durationInMinutes(
      body.hos.carrierMaximumDrivingMinutes,
    ),
    carrierMaxDuty: durationInMinutes(body.hos.carrierMaximumDutyMinutes),
    ...(body.hos.restPreference.enabled
      ? {
          nightlyRestPreference: {
            startLocalTime: body.hos.restPreference.startLocalTime,
            endLocalTime: body.hos.restPreference.endLocalTime,
            timeZone: departureTimeZone,
          },
        }
      : {}),
    provenance,
  };

  return validateDriverHosDepartureState(candidate);
}
