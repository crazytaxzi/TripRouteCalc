import {
  DurationSchema,
  LocalAppointmentWindowSchema,
  StopTypeSchema,
  ianaTimeZone,
  resolveAppointmentWindow,
} from '@trip-route-calc/foundation';
import type {
  Duration,
  LocalAppointmentWindow,
  StopType,
  UtcInstant,
} from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import { hashJson } from './json.js';
import type { Prisma } from './generated/prisma/client.js';
import {
  PRISMA_CALCULATION_CONFIDENCE,
  PRISMA_STOP_TYPES,
  PRISMA_WARNING_SEVERITIES,
  asInputJson,
  assertOwnedOptionalReference,
  positiveSequence,
  toDate,
} from './repository-shared.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

export interface CreateTripStopInput {
  readonly sequence: number;
  readonly type: StopType;
  readonly required: boolean;
  readonly facilityId?: string;
  readonly timeZone: string;
  readonly expectedServiceDuration: Duration;
  readonly appointmentWindow?: LocalAppointmentWindow;
}

export interface CreateCalculationAssumptionInput {
  readonly key: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly explanation: string;
  readonly source: 'user' | 'carrier-policy' | 'system-default';
}

export interface CreateComplianceWarningInput {
  readonly severity: 'information' | 'warning' | 'blocking';
  readonly code: string;
  readonly explanation: string;
  readonly sourceReference?: string;
}

export interface CreateUserOverrideInput {
  readonly key: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly reason: string;
}

export interface CreateCalculationResultInput {
  readonly confidence: 'high' | 'medium' | 'low' | 'blocked';
  readonly confidenceReasons: readonly string[];
  readonly explanation: readonly string[];
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export interface CreateTripRevisionInput {
  readonly tripId: string;
  readonly calculationTimestamp: UtcInstant;
  readonly ruleSetVersion: string;
  readonly routingProviderName?: string;
  readonly routingProviderVersion?: string;
  readonly loadId?: string;
  readonly tractorId?: string;
  readonly trailerId?: string;
  readonly driverHosStateId?: string;
  readonly inputSnapshot: Readonly<Record<string, unknown>>;
  readonly stops: readonly CreateTripStopInput[];
  readonly assumptions?: readonly CreateCalculationAssumptionInput[];
  readonly warnings?: readonly CreateComplianceWarningInput[];
  readonly overrides?: readonly CreateUserOverrideInput[];
  readonly result?: CreateCalculationResultInput;
}

export type PersistedTripRevision = Prisma.TripRevisionGetPayload<{
  include: {
    stops: { include: { appointmentWindow: true } };
    assumptions: true;
    warnings: { include: { acknowledgements: true } };
    overrides: true;
    calculationResult: true;
    providerResponses: true;
    ruleEvidence: true;
    exports: true;
  };
}>;

export type PersistedTrip = Prisma.TripGetPayload<{
  include: { currentRevision: true };
}>;

export class TripRevisionRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async getTrip(tripId: string): Promise<PersistedTrip | null> {
    await assertTenantMembership(this.client, this.context);
    return this.client.trip.findFirst({
      where: { id: tripId, carrierId: this.context.carrierId },
      include: { currentRevision: true },
    });
  }

  public async getRevision(
    revisionId: string,
  ): Promise<PersistedTripRevision | null> {
    await assertTenantMembership(this.client, this.context);
    return this.client.tripRevision.findFirst({
      where: { id: revisionId, carrierId: this.context.carrierId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          include: { appointmentWindow: true },
        },
        assumptions: true,
        warnings: { include: { acknowledgements: true } },
        overrides: true,
        calculationResult: true,
        providerResponses: true,
        ruleEvidence: true,
        exports: true,
      },
    });
  }

  public async createRevision(
    input: CreateTripRevisionInput,
  ): Promise<PersistedTripRevision> {
    await assertTenantMembership(this.client, this.context);

    const normalizedStops = input.stops.map((stop, index) => {
      const sequence = positiveSequence(
        stop.sequence,
        `stops[${String(index)}].sequence`,
      );
      const type = StopTypeSchema.parse(stop.type);
      const timeZone = ianaTimeZone(stop.timeZone);
      const expectedServiceDuration = DurationSchema.parse(
        stop.expectedServiceDuration,
      );
      const appointmentWindow =
        stop.appointmentWindow === undefined
          ? undefined
          : LocalAppointmentWindowSchema.parse(stop.appointmentWindow);
      const resolvedAppointment =
        appointmentWindow === undefined
          ? undefined
          : resolveAppointmentWindow(appointmentWindow);

      return {
        ...stop,
        sequence,
        type,
        timeZone,
        expectedServiceDuration,
        appointmentWindow,
        resolvedAppointment,
      };
    });

    const uniqueSequences = new Set(normalizedStops.map((stop) => stop.sequence));
    if (uniqueSequences.size !== normalizedStops.length) {
      throw new RangeError('Trip-stop sequence values must be unique.');
    }

    const trip = await this.client.trip.findFirst({
      where: { id: input.tripId, carrierId: this.context.carrierId },
      include: { currentRevision: { select: { revisionNumber: true } } },
    });
    if (trip === null) {
      throw new TenantObjectNotFoundError(
        'Trip was not found in the requested carrier account.',
      );
    }

    const optionalChecks: Promise<void>[] = [];
    if (input.loadId !== undefined) {
      optionalChecks.push(
        assertOwnedOptionalReference(
          this.client.load.findFirst({
            where: { id: input.loadId, carrierId: this.context.carrierId },
            select: { id: true },
          }),
          'Load',
        ),
      );
    }
    if (input.tractorId !== undefined) {
      optionalChecks.push(
        assertOwnedOptionalReference(
          this.client.tractor.findFirst({
            where: { id: input.tractorId, carrierId: this.context.carrierId },
            select: { id: true },
          }),
          'Tractor',
        ),
      );
    }
    if (input.trailerId !== undefined) {
      optionalChecks.push(
        assertOwnedOptionalReference(
          this.client.trailer.findFirst({
            where: { id: input.trailerId, carrierId: this.context.carrierId },
            select: { id: true },
          }),
          'Trailer',
        ),
      );
    }
    if (input.driverHosStateId !== undefined) {
      optionalChecks.push(
        assertOwnedOptionalReference(
          this.client.driverHosState.findFirst({
            where: {
              id: input.driverHosStateId,
              carrierId: this.context.carrierId,
            },
            select: { id: true },
          }),
          'Driver HOS state',
        ),
      );
    }
    for (const stop of normalizedStops) {
      if (stop.facilityId !== undefined) {
        optionalChecks.push(
          assertOwnedOptionalReference(
            this.client.facility.findFirst({
              where: {
                id: stop.facilityId,
                carrierId: this.context.carrierId,
              },
              select: { id: true },
            }),
            'Facility',
          ),
        );
      }
    }
    await Promise.all(optionalChecks);

    const assumptions = input.assumptions ?? [];
    const warnings = input.warnings ?? [];
    const overrides = input.overrides ?? [];
    const revisionNumber = (trip.currentRevision?.revisionNumber ?? 0) + 1;
    const calculationTimestamp = toDate(input.calculationTimestamp);
    const contentHash = hashJson({
      calculationTimestamp: input.calculationTimestamp,
      ruleSetVersion: input.ruleSetVersion,
      routingProviderName: input.routingProviderName ?? null,
      routingProviderVersion: input.routingProviderVersion ?? null,
      loadId: input.loadId ?? null,
      tractorId: input.tractorId ?? null,
      trailerId: input.trailerId ?? null,
      driverHosStateId: input.driverHosStateId ?? null,
      inputSnapshot: input.inputSnapshot,
      stops: normalizedStops.map((stop) => ({
        sequence: stop.sequence,
        type: stop.type,
        required: stop.required,
        facilityId: stop.facilityId ?? null,
        timeZone: stop.timeZone,
        expectedServiceDuration: stop.expectedServiceDuration,
        appointmentWindow: stop.appointmentWindow ?? null,
      })),
      assumptions,
      warnings,
      overrides,
      result: input.result ?? null,
    });

    const revisionId = await this.client.$transaction(async (transaction) => {
      const revision = await transaction.tripRevision.create({
        data: {
          carrierId: this.context.carrierId,
          tripId: input.tripId,
          revisionNumber,
          createdByUserId: this.context.actorUserId,
          calculationTimestamp,
          loadId: input.loadId ?? null,
          tractorId: input.tractorId ?? null,
          trailerId: input.trailerId ?? null,
          driverHosStateId: input.driverHosStateId ?? null,
          ruleSetVersion: input.ruleSetVersion,
          routingProviderName: input.routingProviderName ?? null,
          routingProviderVersion: input.routingProviderVersion ?? null,
          inputSnapshot: asInputJson(input.inputSnapshot, 'inputSnapshot'),
          ...(input.result === undefined
            ? {}
            : {
                resultSnapshot: asInputJson(
                  input.result.snapshot,
                  'result.snapshot',
                ),
              }),
          warningsSnapshot: asInputJson({ warnings }, 'warningsSnapshot'),
          acknowledgementsSnapshot: asInputJson(
            { acknowledgements: [] },
            'acknowledgementsSnapshot',
          ),
          overridesSnapshot: asInputJson({ overrides }, 'overridesSnapshot'),
          contentHash,
        },
        select: { id: true },
      });

      for (const stop of normalizedStops) {
        const createdStop = await transaction.tripStop.create({
          data: {
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            sequence: stop.sequence,
            type: PRISMA_STOP_TYPES[stop.type],
            required: stop.required,
            facilityId: stop.facilityId ?? null,
            timeZone: stop.timeZone,
            expectedServiceDurationValue: BigInt(
              stop.expectedServiceDuration.value,
            ),
            expectedServiceDurationUnit: stop.expectedServiceDuration.unit,
          },
          select: { id: true },
        });

        if (
          stop.appointmentWindow !== undefined &&
          stop.resolvedAppointment !== undefined
        ) {
          await transaction.appointmentWindow.create({
            data: {
              carrierId: this.context.carrierId,
              stopId: createdStop.id,
              startLocalDateTime:
                stop.appointmentWindow.start.localDateTime,
              startTimeZone: stop.appointmentWindow.start.timeZone,
              startRepeatedTimeChoice:
                stop.appointmentWindow.start.repeatedTimeChoice ?? null,
              startAt: new Date(stop.resolvedAppointment.startInstant),
              endLocalDateTime: stop.appointmentWindow.end.localDateTime,
              endTimeZone: stop.appointmentWindow.end.timeZone,
              endRepeatedTimeChoice:
                stop.appointmentWindow.end.repeatedTimeChoice ?? null,
              endAt: new Date(stop.resolvedAppointment.endInstant),
            },
          });
        }
      }

      for (const assumption of assumptions) {
        await transaction.calculationAssumption.create({
          data: {
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            key: assumption.key,
            value: asInputJson(assumption.value, `assumption.${assumption.key}`),
            explanation: assumption.explanation,
            source: assumption.source,
          },
        });
      }

      for (const warning of warnings) {
        await transaction.complianceWarning.create({
          data: {
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            severity: PRISMA_WARNING_SEVERITIES[warning.severity],
            code: warning.code,
            explanation: warning.explanation,
            sourceReference: warning.sourceReference ?? null,
          },
        });
      }

      for (const override of overrides) {
        await transaction.userOverride.create({
          data: {
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            userId: this.context.actorUserId,
            key: override.key,
            value: asInputJson(override.value, `override.${override.key}`),
            reason: override.reason,
          },
        });
      }

      if (input.result !== undefined) {
        await transaction.calculationResult.create({
          data: {
            carrierId: this.context.carrierId,
            tripRevisionId: revision.id,
            calculatedAt: calculationTimestamp,
            confidence: PRISMA_CALCULATION_CONFIDENCE[input.result.confidence],
            confidenceReasons: asInputJson(
              { values: [...input.result.confidenceReasons] },
              'result.confidenceReasons',
            ),
            explanation: asInputJson(
              { values: [...input.result.explanation] },
              'result.explanation',
            ),
            resultSnapshot: asInputJson(
              input.result.snapshot,
              'result.snapshot',
            ),
          },
        });
      }

      const advanced = await transaction.trip.updateMany({
        where: {
          id: input.tripId,
          carrierId: this.context.carrierId,
          currentRevisionId: trip.currentRevisionId,
        },
        data: { currentRevisionId: revision.id },
      });
      if (advanced.count !== 1) {
        throw new Error(
          'Trip revision changed concurrently; retry from the latest revision.',
        );
      }

      await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'trip-revision',
          entityId: revision.id,
          action: 'created',
          metadata: asInputJson(
            { tripId: input.tripId, revisionNumber, contentHash },
            'audit.metadata',
          ),
        },
      });

      return revision.id;
    });

    const persisted = await this.getRevision(revisionId);
    if (persisted === null) {
      throw new Error('The committed trip revision could not be reloaded.');
    }
    return persisted;
  }
}
