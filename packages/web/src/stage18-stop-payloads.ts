import type { DutyStatus, TripStopDraft } from './model.js';
import type { StopPlanningFacts } from './stage18-detail-types.js';

function nonempty(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function duration(minutes: number): Readonly<{ value: number; unit: 'minute' }> {
  return { value: minutes, unit: 'minute' };
}

function appointmentPayload(
  facts: StopPlanningFacts,
  timeZone: string,
): Readonly<Record<string, unknown>> {
  const at = { localDateTime: facts.appointmentAt, timeZone };
  const lateTolerance = duration(facts.lateToleranceMinutes);
  switch (facts.appointmentMode) {
    case 'none':
      return { mode: 'none' };
    case 'earliest':
      return { mode: 'earliest', at };
    case 'latest':
      return { mode: 'latest', at, lateTolerance };
    case 'fixed':
      return { mode: 'fixed', at, lateTolerance };
    case 'window':
    case 'open-window':
      return {
        mode: facts.appointmentMode,
        window: {
          start: { localDateTime: facts.appointmentStartAt, timeZone },
          end: { localDateTime: facts.appointmentEndAt, timeZone },
        },
        lateTolerance,
      };
  }
}

function facilityHoursPayload(
  text: string,
  timeZone: string,
): Readonly<{ windows: readonly Readonly<Record<string, unknown>>[] }> {
  const windows = text
    .split(/\r?\n/u)
    .map((line): string => line.trim())
    .filter((line): boolean => line !== '')
    .map((line) => {
      const [start = '', end = ''] = line.split('|');
      return {
        start: { localDateTime: start.trim(), timeZone },
        end: { localDateTime: end.trim(), timeZone },
      };
    });
  return { windows };
}

function servicePayload(facts: StopPlanningFacts): Readonly<Record<string, unknown>> {
  switch (facts.serviceMode) {
    case 'exact':
      return { mode: 'exact', duration: duration(facts.serviceMinutes) };
    case 'expected':
      return { mode: 'expected', duration: duration(facts.serviceMinutes) };
    case 'range':
      return {
        mode: 'range',
        minimum: duration(facts.serviceMinimumMinutes),
        expected: duration(facts.serviceExpectedMinutes),
        maximum: duration(facts.serviceMaximumMinutes),
      };
    case 'historical-average':
      return {
        mode: 'historical-average',
        duration: duration(facts.serviceMinutes),
        sourceName: facts.historicalSourceName.trim(),
        ...(facts.historicalSampleSize === null ? {} : { sampleSize: facts.historicalSampleSize }),
      };
  }
}

function publicDutyStatus(value: DutyStatus): string {
  return value.toUpperCase();
}

export function completeStopPayload(
  stop: TripStopDraft,
  facts: StopPlanningFacts,
): Readonly<Record<string, unknown>> {
  const timeZone = stop.appointment.timeZone;
  return {
    type: stop.type.replaceAll('_', '-'),
    required: stop.required,
    lockedPosition: stop.lockedPosition,
    location: {
      description: stop.label.trim() === '' ? stop.address.trim() : stop.label.trim(),
      addressText: stop.address.trim(),
      timeZone,
      latitude: facts.latitude,
      longitude: facts.longitude,
      resolutionStatus: facts.resolutionStatus,
      sourceName: facts.sourceName.trim(),
      ...(nonempty(facts.providerReference) === undefined ? {} : { providerReference: facts.providerReference.trim() }),
    },
    appointment: appointmentPayload(facts, timeZone),
    facilityHours: facilityHoursPayload(facts.facilityHoursText, timeZone),
    checkInDuration: duration(facts.checkInMinutes),
    serviceDuration: servicePayload(facts),
    waitingDutyStatus: publicDutyStatus(facts.waitingDutyStatus),
    checkInDutyStatus: publicDutyStatus(facts.checkInDutyStatus),
    serviceDutyStatus: publicDutyStatus(facts.serviceDutyStatus),
    earlyParkingAllowed: facts.earlyParkingAllowed,
    overnightParkingAllowed: facts.overnightParkingAllowed,
    ...(nonempty(stop.notes) === undefined ? {} : { notes: stop.notes.trim() }),
    ...(nonempty(facts.instructions) === undefined ? {} : { instructions: facts.instructions.trim() }),
  };
}
