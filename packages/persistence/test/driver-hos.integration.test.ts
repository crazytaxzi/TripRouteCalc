import { randomUUID } from 'node:crypto';

import {
  utcInstant,
  validateDriverHosDepartureState,
  validateDutyEvent,
} from '@trip-route-calc/foundation';
import type {
  DriverHosDepartureState,
  DutyEvent,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TenantObjectNotFoundError,
  createDriverHosRevision,
  createPersistenceClient,
  databaseUrlFromEnvironment,
  getDriverHosRevision,
} from '../src/index.js';
import type { PersistenceClient, TenantContext } from '../src/index.js';

let client: PersistenceClient;

const unverifiedUser = Object.freeze({
  origin: 'USER_ENTERED' as const,
  verification: 'UNVERIFIED' as const,
  sourceName: 'integration test',
  explanation: 'Test evidence entered by the caller.',
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

async function seedCarrier(label: string): Promise<{
  readonly context: TenantContext;
  readonly driverId: string;
}> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      displayName: `${label} user`,
    },
  });
  const carrier = await client.carrier.create({
    data: {
      legalName: `${label} carrier ${suffix}`,
      homeTerminalTimeZone: 'America/Boise',
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
      displayName: `${label} driver`,
    },
  });
  return {
    context: { carrierId: carrier.id, actorUserId: user.id },
    driverId: driver.id,
  };
}

function departureState(driverId: string): DriverHosDepartureState {
  return validateDriverHosDepartureState({
    driver: { id: driverId, nameOrIdentifier: 'Integration driver' },
    departureAt: '2026-07-20T12:00:00.000Z',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'ON_DUTY_NOT_DRIVING',
    currentDutyStatusStartedAt: '2026-07-20T11:30:00.000Z',
    drivingTimeRemaining: { value: 570, unit: 'minute' },
    shiftTimeRemaining: { value: 405, unit: 'minute' },
    cycleTimeRemaining: { value: 1320, unit: 'minute' },
    cycleType: 'SEVENTY_HOURS_EIGHT_DAYS',
    drivenSinceLastQualifyingInterruption: { value: 90, unit: 'minute' },
    onDutyTimeCurrentShift: { value: 120, unit: 'minute' },
    offDutyTimeImmediatelyBeforeDeparture: { value: 600, unit: 'minute' },
    qualifyingTenHourBreakCompleted: true,
    priorDutyDays: Array.from({ length: 8 }, (_, index) => ({
      date: `2026-07-${String(12 + index).padStart(2, '0')}`,
      onDutyTime: { value: 480, unit: 'minute' },
    })),
    recapReturns: [],
    sleeperBerthEligible: false,
    existingSleeperPeriods: [],
    splitSleeperEnabled: false,
    restart34HourPlanned: false,
    carrierMaxDailyDriving: { value: 630, unit: 'minute' },
    carrierMaxDuty: { value: 780, unit: 'minute' },
    provenance,
  });
}

function preTripEvent(): DutyEvent {
  return validateDutyEvent({
    id: randomUUID(),
    startAt: '2026-07-20T11:30:00.000Z',
    endAt: '2026-07-20T12:00:00.000Z',
    duration: { value: 30, unit: 'minute' },
    dutyStatus: 'ON_DUTY_NOT_DRIVING',
    eventType: 'PRE_TRIP_INSPECTION',
    location: {
      description: 'Boise terminal',
      timeZone: 'America/Boise',
    },
    source: 'USER_ENTERED',
    explanation: 'Pre-trip inspection immediately before departure.',
    clockEffects: {
      driving: 'DOES_NOT_CONSUME',
      shift: 'ADVANCES_WINDOW',
      cycle: 'CONSUMES',
    },
    qualifiesForThirtyMinuteInterruption: true,
    sleeperPair: { participates: false },
    provenance: unverifiedUser,
  });
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
});

afterAll(async () => {
  await client.$disconnect();
});

describe('driver HOS revisions', () => {
  it('persists, reloads, tenant-scopes, hashes, and protects complete HOS evidence', async () => {
    const tenant = await seedCarrier('hos-owner');
    const foreignTenant = await seedCarrier('hos-foreign');
    const created = await createDriverHosRevision(client, tenant.context, {
      state: departureState(tenant.driverId),
      dutyEvents: [preTripEvent()],
      expectedHistoryStartAt: utcInstant('2026-07-20T11:30:00.000Z'),
    });

    expect(created.eventCount).toBe(1);
    expect(created.stateHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(created.historyHash).toMatch(/^[a-f0-9]{64}$/u);

    const loaded = await getDriverHosRevision(
      client,
      tenant.context,
      created.stateRevisionId,
    );
    expect(loaded.state.drivingTimeRemaining.value).toBe(570);
    expect(loaded.state.shiftTimeRemaining.value).toBe(405);
    expect(loaded.state.cycleTimeRemaining.value).toBe(1320);
    expect(loaded.dutyEvents).toHaveLength(1);
    expect(loaded.stateHash).toBe(created.stateHash);
    expect(loaded.historyHash).toBe(created.historyHash);

    await expect(
      getDriverHosRevision(
        client,
        foreignTenant.context,
        created.stateRevisionId,
      ),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);

    await expect(
      client.$executeRaw`
        UPDATE driver_hos_departure_state_revisions
        SET departure_time_zone = 'UTC'
        WHERE id = ${created.stateRevisionId}::uuid
      `,
    ).rejects.toThrow(/append-only/u);
  });
});
