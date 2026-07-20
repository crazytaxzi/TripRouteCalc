import { randomUUID } from 'node:crypto';

import {
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '@trip-route-calc/foundation';
import type {
  DriverHosDepartureState,
  DutyEvent,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDriverHosRevision,
  createPersistenceClient,
  databaseUrlFromEnvironment,
  getDriverHosRevision,
} from '../src/index.js';
import type { PersistenceClient, TenantContext } from '../src/index.js';

let client: PersistenceClient;

const provenanceValue = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'Stage 08 persistence fixture',
  explanation: 'Test-only UTC and sleeper-pair evidence.',
});

const provenance = Object.freeze({
  driver: provenanceValue,
  departure: provenanceValue,
  dutyStatus: provenanceValue,
  clocks: provenanceValue,
  dutyHistory: provenanceValue,
  sleeper: provenanceValue,
  carrierPolicy: provenanceValue,
  restPreference: provenanceValue,
});

async function seedTenant(): Promise<{
  readonly context: TenantContext;
  readonly driverId: string;
}> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: {
      email: `stage08-${suffix}@example.test`,
      displayName: 'Stage 08 persistence user',
    },
  });
  const carrier = await client.carrier.create({
    data: {
      legalName: `Stage 08 carrier ${suffix}`,
      homeTerminalTimeZone: 'America/Los_Angeles',
    },
  });
  await client.carrierMembership.create({
    data: {
      carrierId: carrier.id,
      userId: user.id,
      role: 'OWNER',
    },
  });
  const driver = await client.driver.create({
    data: {
      carrierId: carrier.id,
      displayName: 'Stage 08 driver',
    },
  });
  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    driverId: driver.id,
  };
}

function departureState(driverId: string): DriverHosDepartureState {
  return validateDriverHosDepartureState({
    driver: { id: driverId, nameOrIdentifier: 'Stage 08 driver' },
    departureAt: '2026-11-01T09:30:00.000Z',
    departureTimeZone: 'America/Los_Angeles',
    currentDutyStatus: 'OFF_DUTY',
    currentDutyStatusStartedAt: '2026-11-01T07:30:00.000Z',
    drivingTimeRemaining: { value: 480, unit: 'minute' },
    shiftTimeRemaining: { value: 660, unit: 'minute' },
    cycleTimeRemaining: { value: 1800, unit: 'minute' },
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: { value: 0, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 180, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 120, unit: 'minute' },
    qualifyingTenHourBreakCompleted: false,
    priorDutyDays: Array.from({ length: 8 }, (_, index) => ({
      date: `2026-10-${String(24 + index).padStart(2, '0')}`,
      onDutyTime: { value: 300, unit: 'minute' },
    })),
    recapReturns: [],
    sleeperBerthEligible: true,
    existingSleeperPeriods: [{
      id: 'stage08-long-period',
      startAt: '2026-11-01T00:30:00.000Z',
      endAt: '2026-11-01T07:30:00.000Z',
      duration: { value: 420, unit: 'minute' },
      candidateRole: 'LONG_PERIOD',
      pairId: 'stage08-dst-pair',
      source: 'USER_ENTERED',
      explanation: 'Seven consecutive sleeper-berth hours before the short period.',
    }],
    splitSleeperEnabled: true,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 600, unit: 'minute' },
    carrierMaxDuty: { value: 780, unit: 'minute' },
    nightlyRestPreference: {
      startLocalTime: '21:00',
      endLocalTime: '06:00',
      timeZone: 'America/Los_Angeles',
    },
    provenance,
  });
}

function shortPeriodEvent(): DutyEvent {
  return validateDutyEvent({
    id: 'stage08-short-period',
    startAt: '2026-11-01T07:30:00.000Z',
    endAt: '2026-11-01T09:30:00.000Z',
    duration: { value: 120, unit: 'minute' },
    dutyStatus: 'OFF_DUTY',
    eventType: 'REST',
    location: {
      description: 'Los Angeles repeated-time boundary fixture',
      timeZone: 'America/Los_Angeles',
    },
    source: 'USER_ENTERED',
    explanation: 'Two actual UTC hours spanning the fall repeated local hour.',
    clockEffects: {
      driving: 'DOES_NOT_CONSUME',
      shift: 'ADVANCES_WINDOW',
      cycle: 'DOES_NOT_CONSUME',
    },
    qualifiesForThirtyMinuteInterruption: true,
    sleeperPair: {
      participates: true,
      pairId: 'stage08-dst-pair',
      candidateRole: 'SHORT_PERIOD',
    },
    provenance: provenanceValue,
  });
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
});

afterAll(async () => {
  await client.$disconnect();
});

describe('Stage 08 persistence-to-domain HOS mapping', () => {
  it('round-trips UTC instants, IANA zones, sleeper identity, and hashes across a repeated local hour', async () => {
    const tenant = await seedTenant();
    const state = departureState(tenant.driverId);
    const shortPeriod = shortPeriodEvent();
    const created = await createDriverHosRevision(client, tenant.context, {
      state,
      dutyEvents: [shortPeriod],
      expectedHistoryStartAt: shortPeriod.startAt,
    });
    const loaded = await getDriverHosRevision(
      client,
      tenant.context,
      created.stateRevisionId,
    );

    expect(loaded.state.departureAt).toBe('2026-11-01T09:30:00.000Z');
    expect(loaded.state.departureTimeZone).toBe('America/Los_Angeles');
    expect(loaded.state.existingSleeperPeriods[0]?.pairId).toBe('stage08-dst-pair');
    expect(loaded.state.existingSleeperPeriods[0]?.duration.value).toBe(420);
    expect(loaded.dutyEvents[0]?.startAt).toBe('2026-11-01T07:30:00.000Z');
    expect(loaded.dutyEvents[0]?.endAt).toBe('2026-11-01T09:30:00.000Z');
    expect(loaded.dutyEvents[0]?.duration.value).toBe(120);
    expect(loaded.dutyEvents[0]?.location.timeZone).toBe('America/Los_Angeles');
    expect(loaded.dutyEvents[0]?.sleeperPair.pairId).toBe('stage08-dst-pair');
    expect(loaded.dutyEvents[0]?.sleeperPair.candidateRole).toBe('SHORT_PERIOD');
    expect(loaded.stateHash).toBe(created.stateHash);
    expect(loaded.historyHash).toBe(created.historyHash);
  });
});
