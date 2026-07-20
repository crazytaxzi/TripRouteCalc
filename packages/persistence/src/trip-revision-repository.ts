import {
  DurationSchema,
  LocalAppointmentWindowSchema,
  StopTypeSchema,
  ianaTimeZone,
  validateTripStopPlan,
  resolveAppointmentWindow,
} from '@trip-route-calc/foundation';
import type {
  Duration,
  LocalAppointmentWindow,
  StopServiceDurationPlan,
  StopType,
  TripStopPlan,
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

export type CreateTripStopDetailsInput = Omit<
  TripStopPlan,
  'id' | 'sequence' | 'type' | 'required'
>;

export interface CreateTripStopInput {
  readonly sequence: number;
  readonly type: StopType;
  readonly required: boolean;
  readonly facilityId?: string;
  readonly timeZone: string;
  readonly expectedServiceDuration: Duration;
  readonly appointmentWindow?: LocalAppointmentWindow;
  readonly details?: CreateTripStopDetailsInput;
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
    stops: { include: { appointmentWindow: true; details: true } };
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

interface ServiceDurationColumns {
  readonly minimum: bigint | null;
  readonly expected: bigint;
  readonly maximum: bigint | null;
  readonly historicalAverageSource: string | null;
  readonly historicalAverageSampleSize: number | null;
}

function serviceDurationColumns(
  plan: StopServiceDurationPlan,
): ServiceDurationColumns {
  switch (plan.mode) {
    case 'exact':
    case 'expected':
      return {
        minimum: null,
        expected: BigInt(plan.duration.value),
        maximum: null,
        historicalAverageSource: null,
        historicalAverageSampleSize: null,
      };
    case 'range':
      return {
        minimum: BigInt(plan.minimum.value),
        expected: BigInt(plan.expected.value),
        maximum: BigInt(plan.maximum.value),
        historicalAverageSource: null,
        historicalAverageSampleSize: null,
      };
    case 'historical-average':
      return {
        minimum: null,
        expected: BigInt(plan.duration.value),
        maximum: null,
        historicalAverageSource: plan.sourceName,
        historicalAverageSampleSize: plan.sampleSize ?? null,
      };
  }
}

function expectedServiceMinutes(plan: StopServiceDurationPlan): number {
  return Number(serviceDurationColumns(plan).expected);
}

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
          include: { appointmentWindow: true, details: true },
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
      const details =
        stop.details === undefined
          ? undefined
          : validateTripStopPlan({
              id: `revision-stop-${String(sequence)}`,
              sequence,
              type,
              required: stop.required,
              ...stop.details,
            });
      if (details !== undefined && details.location.timeZone !== timeZone) {
        throw new RangeError(
          `stops[${String(index)}].details location time zone must match the base stop time zone.`,
        );
      }
      if (
        details !== undefined &&
        expectedServiceMinutes(details.serviceDuration) !==
          expectedServiceDuration.value
      ) {
        throw new RangeError(
          `stops[${String(index)}] expected service duration must match the detailed stop service expectation.`,
        );
      }

      return {
        ...stop,
        sequence,
        type,
        timeZone,
        expectedServiceDuration,
        appointmentWindow,
        resolvedAppointment,
        ...(details === undefined ? {} : { details }),
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
        details: stop.details ?? null,
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
            ...(stop.details === undefined
              ? {}
              : {
                  details: {
                    create: {
                      carrierId: this.context.carrierId,
                      lockedPosition: stop.details.lockedPosition,
                      locationDescription: stop.details.location.description,
                      addressText: stop.details.location.addressText ?? null,
                      latitude: stop.details.location.latitude ?? null,
                      longitude: stop.details.location.longitude ?? null,
                      locationResolutionStatus:
                        stop.details.location.resolutionStatus,
                      locationSourceName:
                        stop.details.location.sourceName ?? null,
                      locationProviderReference:
                        stop.details.location.providerReference ?? null,
                      appointmentMode: stop.details.appointment.mode,
                      appointmentSnapshot: asInputJson(
                        stop.details.appointment,
                        `stop.${String(stop.sequence)}.appointment`,
                      ),
                      facilityHoursSnapshot: asInputJson(
                        stop.details.facilityHours,
                        `stop.${String(stop.sequence)}.facilityHours`,
                      ),
                      checkInDurationValue: BigInt(
                        stop.details.checkInDuration.value,
                      ),
                      checkInDurationUnit:
                        stop.details.checkInDuration.unit,
                      serviceDurationMode:
                        stop.details.serviceDuration.mode,
                      serviceMinimumDurationValue:
                        serviceDurationColumns(stop.details.serviceDuration)
                          .minimum,
                      serviceExpectedDurationValue:
                        serviceDurationColumns(stop.details.serviceDuration)
                          .expected,
                      serviceMaximumDurationValue:
                        serviceDurationColumns(stop.details.serviceDuration)
                          .maximum,
                      serviceDurationUnit: 'minute',
                      historicalAverageSource:
                        serviceDurationColumns(stop.details.serviceDuration)
                          .historicalAverageSource,
                      historicalAverageSampleSize:
                        serviceDurationColumns(stop.details.serviceDuration)
                          .historicalAverageSampleSize,
                      waitingDutyStatus: stop.details.waitingDutyStatus,
                      checkInDutyStatus: stop.details.checkInDutyStatus,
                      serviceDutyStatus: stop.details.serviceDutyStatus,
                      earlyParkingAllowed:
                        stop.details.earlyParkingAllowed,
                      overnightParkingAllowed:
                        stop.details.overnightParkingAllowed,
                      notes: stop.details.notes ?? null,
                      instructions: stop.details.instructions ?? null,
                    },
                  },
                }),
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
