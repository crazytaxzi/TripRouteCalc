import {
  deserializeDriverHosDepartureState,
  driverHosDepartureStateToApi,
  validateDriverHosDepartureState,
  validateDutyEventHistory,
} from '@trip-route-calc/foundation';
import type {
  DriverHosDepartureState,
  DutyEvent,
  UtcInstant,
} from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import { hashJson } from './json.js';
import { assertTenantMembership } from './tenant.js';
import type { TenantContext } from './tenant.js';

export interface CreateDriverHosRevisionInput {
  readonly state: DriverHosDepartureState;
  readonly dutyEvents: readonly DutyEvent[];
  readonly expectedHistoryStartAt?: UtcInstant;
}

export interface DriverHosRevisionSummary {
  readonly stateRevisionId: string;
  readonly historyRevisionId: string;
  readonly carrierId: string;
  readonly driverId: string;
  readonly recordedAt: UtcInstant;
  readonly stateHash: string;
  readonly historyHash: string;
  readonly eventCount: number;
}

export interface LoadedDriverHosRevision extends DriverHosRevisionSummary {
  readonly state: DriverHosDepartureState;
  readonly dutyEvents: readonly DutyEvent[];
}

interface StateInsertRow {
  readonly id: string;
  readonly recordedAt: Date | string;
  readonly payloadHash: string;
}

interface HistoryInsertRow {
  readonly id: string;
  readonly payloadHash: string;
  readonly eventCount: number;
}

interface LoadedStateRow extends StateInsertRow {
  readonly carrierId: string;
  readonly driverId: string;
  readonly payload: unknown;
}

interface LoadedHistoryRow extends HistoryInsertRow {
  readonly payload: unknown;
}

function asUtcInstant(value: Date | string): UtcInstant {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Persistence returned an invalid timestamp.');
  return date.toISOString() as UtcInstant;
}

function statePayload(state: DriverHosDepartureState): ReturnType<typeof driverHosDepartureStateToApi> {
  return driverHosDepartureStateToApi(validateDriverHosDepartureState(state));
}

function eventPayload(events: readonly DutyEvent[], state: DriverHosDepartureState, expectedHistoryStartAt?: UtcInstant): readonly DutyEvent[] {
  return validateDutyEventHistory(events, {
    ...(expectedHistoryStartAt === undefined ? {} : { expectedStartAt: expectedHistoryStartAt }),
    expectedEndAt: state.departureAt,
  });
}

async function assertDriverOwned(
  transaction: Pick<PersistenceClient, 'driver'>,
  context: TenantContext,
  driverId: string,
): Promise<void> {
  const driver = await transaction.driver.findFirst({
    where: { id: driverId, carrierId: context.carrierId },
    select: { id: true },
  });
  if (driver === null) {
    throw new TenantObjectNotFoundError(
      'Driver was not found in the requested carrier account.',
    );
  }
}

export async function createDriverHosRevision(
  client: PersistenceClient,
  context: TenantContext,
  input: CreateDriverHosRevisionInput,
): Promise<DriverHosRevisionSummary> {
  await assertTenantMembership(client, context);

  const state = validateDriverHosDepartureState(input.state);
  const driverId = state.driver.id;
  if (driverId === undefined) {
    throw new TypeError('Persisted HOS departure state requires driver.id.');
  }

  const events = eventPayload(input.dutyEvents, state, input.expectedHistoryStartAt);
  const serializedState = statePayload(state);
  const stateHash = hashJson(serializedState);
  const historyHash = hashJson(events);
  const stateJson = JSON.stringify(serializedState);
  const historyJson = JSON.stringify(events);
  const historyStartAt = events[0]?.startAt ?? state.departureAt;
  const historyEndAt = events.at(-1)?.endAt ?? state.departureAt;

  return client.$transaction(async (transaction) => {
    await assertDriverOwned(transaction, context, driverId);

    const stateRows = await transaction.$queryRaw<StateInsertRow[]>`
      INSERT INTO driver_hos_departure_state_revisions (
        carrier_id,
        driver_id,
        actor_user_id,
        departure_at,
        departure_time_zone,
        current_duty_status,
        current_duty_status_started_at,
        driving_remaining_minutes,
        shift_remaining_minutes,
        cycle_remaining_minutes,
        cycle_type,
        state_payload,
        payload_hash
      ) VALUES (
        ${context.carrierId}::uuid,
        ${driverId}::uuid,
        ${context.actorUserId}::uuid,
        ${state.departureAt}::timestamptz,
        ${state.departureTimeZone},
        ${state.currentDutyStatus},
        ${state.currentDutyStatusStartedAt}::timestamptz,
        ${state.drivingTimeRemaining.value}::bigint,
        ${state.shiftTimeRemaining.value}::bigint,
        ${state.cycleTimeRemaining.value}::bigint,
        ${state.cycleType},
        ${stateJson}::jsonb,
        ${stateHash}
      )
      RETURNING
        id,
        recorded_at AS "recordedAt",
        payload_hash AS "payloadHash"
    `;
    const stateRow = stateRows[0];
    if (stateRow === undefined) throw new Error('HOS state insert did not return a row.');

    const historyRows = await transaction.$queryRaw<HistoryInsertRow[]>`
      INSERT INTO driver_hos_duty_event_history_revisions (
        carrier_id,
        driver_id,
        state_revision_id,
        actor_user_id,
        history_start_at,
        history_end_at,
        event_count,
        event_payload,
        payload_hash
      ) VALUES (
        ${context.carrierId}::uuid,
        ${driverId}::uuid,
        ${stateRow.id}::uuid,
        ${context.actorUserId}::uuid,
        ${historyStartAt}::timestamptz,
        ${historyEndAt}::timestamptz,
        ${events.length},
        ${historyJson}::jsonb,
        ${historyHash}
      )
      RETURNING
        id,
        payload_hash AS "payloadHash",
        event_count AS "eventCount"
    `;
    const historyRow = historyRows[0];
    if (historyRow === undefined) throw new Error('HOS event-history insert did not return a row.');

    return Object.freeze({
      stateRevisionId: stateRow.id,
      historyRevisionId: historyRow.id,
      carrierId: context.carrierId,
      driverId,
      recordedAt: asUtcInstant(stateRow.recordedAt),
      stateHash: stateRow.payloadHash,
      historyHash: historyRow.payloadHash,
      eventCount: historyRow.eventCount,
    });
  });
}

export async function getDriverHosRevision(
  client: PersistenceClient,
  context: TenantContext,
  stateRevisionId: string,
): Promise<LoadedDriverHosRevision> {
  await assertTenantMembership(client, context);

  const stateRows = await client.$queryRaw<LoadedStateRow[]>`
    SELECT
      id,
      carrier_id AS "carrierId",
      driver_id AS "driverId",
      recorded_at AS "recordedAt",
      state_payload AS payload,
      payload_hash AS "payloadHash"
    FROM driver_hos_departure_state_revisions
    WHERE id = ${stateRevisionId}::uuid
      AND carrier_id = ${context.carrierId}::uuid
    LIMIT 1
  `;
  const stateRow = stateRows[0];
  if (stateRow === undefined) {
    throw new TenantObjectNotFoundError(
      'HOS departure-state revision was not found in the requested carrier account.',
    );
  }

  const historyRows = await client.$queryRaw<LoadedHistoryRow[]>`
    SELECT
      id,
      event_payload AS payload,
      payload_hash AS "payloadHash",
      event_count AS "eventCount"
    FROM driver_hos_duty_event_history_revisions
    WHERE state_revision_id = ${stateRevisionId}::uuid
      AND carrier_id = ${context.carrierId}::uuid
    ORDER BY recorded_at DESC
    LIMIT 1
  `;
  const historyRow = historyRows[0];
  if (historyRow === undefined) {
    throw new TenantObjectNotFoundError(
      'HOS duty-event history was not found in the requested carrier account.',
    );
  }

  const state = deserializeDriverHosDepartureState(JSON.stringify(stateRow.payload));
  const dutyEvents = validateDutyEventHistory(historyRow.payload, {
    expectedEndAt: state.departureAt,
  });
  const stateHash = hashJson(driverHosDepartureStateToApi(state));
  const historyHash = hashJson(dutyEvents);
  if (stateHash !== stateRow.payloadHash || historyHash !== historyRow.payloadHash) {
    throw new Error('Persisted HOS revision payload hash verification failed.');
  }

  return Object.freeze({
    stateRevisionId: stateRow.id,
    historyRevisionId: historyRow.id,
    carrierId: stateRow.carrierId,
    driverId: stateRow.driverId,
    recordedAt: asUtcInstant(stateRow.recordedAt),
    stateHash,
    historyHash,
    eventCount: historyRow.eventCount,
    state,
    dutyEvents,
  });
}
