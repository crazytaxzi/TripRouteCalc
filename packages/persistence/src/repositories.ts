import {
  DurationSchema,
  LocalAppointmentWindowSchema,
  StopTypeSchema,
  ianaTimeZone,
  resolveAppointmentWindow,
  utcInstant,
} from '@trip-route-calc/foundation';
import type {
  Duration,
  LocalAppointmentWindow,
  StopType,
  UtcInstant,
} from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import {
  ProviderEvidenceError,
  TenantObjectNotFoundError,
} from './errors.js';
import type { JsonObject } from './json.js';
import { hashJson, toJsonObject } from './json.js';
import type { Prisma } from './generated/prisma/client.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

function asInputJson(value: unknown, path: string): Prisma.InputJsonValue {
  return toJsonObject(value, path) as Prisma.InputJsonValue;
}

function asOptionalInputJson(
  value: unknown | undefined,
  path: string,
): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : asInputJson(value, path);
}

function toDate(value: UtcInstant): Date {
  return new Date(utcInstant(value));
}

function positiveSequence(value: number, path: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${path} must be a positive safe integer.`);
  }
  return value;
}

function assertSha256(value: string, path: string): string {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

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

async function assertOwnedOptionalReference(
  exists: Promise<{ id: string } | null>,
  label: string,
): Promise<void> {
  if ((await exists) === null) {
    throw new TenantObjectNotFoundError(
      `${label} was not found in the requested carrier account.`,
    );
  }
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
      const sequence = positiveSequence(stop.sequence, `stops[${index}].sequence`);
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
          loadId: input.loadId,
          tractorId: input.tractorId,
          trailerId: input.trailerId,
          driverHosStateId: input.driverHosStateId,
          ruleSetVersion: input.ruleSetVersion,
          routingProviderName: input.routingProviderName,
          routingProviderVersion: input.routingProviderVersion,
          inputSnapshot: asInputJson(input.inputSnapshot, 'inputSnapshot'),
          resultSnapshot:
            input.result === undefined
              ? undefined
              : asInputJson(input.result.snapshot, 'result.snapshot'),
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
            type: stop.type,
            required: stop.required,
            facilityId: stop.facilityId,
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
                stop.appointmentWindow.start.repeatedTimeChoice,
              startAt: new Date(stop.resolvedAppointment.startInstant),
              endLocalDateTime: stop.appointmentWindow.end.localDateTime,
              endTimeZone: stop.appointmentWindow.end.timeZone,
              endRepeatedTimeChoice:
                stop.appointmentWindow.end.repeatedTimeChoice,
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
            severity: warning.severity,
            code: warning.code,
            explanation: warning.explanation,
            sourceReference: warning.sourceReference,
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
            confidence: input.result.confidence,
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

export interface SaveRouteProviderResponseInput {
  readonly tripRevisionId: string;
  readonly routeId?: string;
  readonly providerName: string;
  readonly providerVersion?: string;
  readonly providerRequestId?: string;
  readonly receivedAt: UtcInstant;
  readonly storageMode:
    | 'raw-json'
    | 'normalized-snapshot'
    | 'provider-reference';
  readonly licenseAllowsRawStorage: boolean;
  readonly rawResponse?: Readonly<Record<string, unknown>>;
  readonly normalizedSnapshot?: Readonly<Record<string, unknown>>;
  readonly providerReference?: string;
  readonly responseHash?: string;
}

export class RouteProviderResponseRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async save(
    input: SaveRouteProviderResponseInput,
  ): Promise<Prisma.RouteProviderResponseGetPayload<Record<string, never>>> {
    await assertTenantMembership(this.client, this.context);

    if (input.rawResponse !== undefined && !input.licenseAllowsRawStorage) {
      throw new ProviderEvidenceError(
        'Raw provider responses cannot be stored when the provider license disallows retention.',
      );
    }
    if (input.storageMode === 'raw-json' && input.rawResponse === undefined) {
      throw new ProviderEvidenceError(
        'Raw JSON storage mode requires a raw provider response.',
      );
    }
    if (
      input.storageMode === 'normalized-snapshot' &&
      input.normalizedSnapshot === undefined
    ) {
      throw new ProviderEvidenceError(
        'Normalized storage mode requires a normalized provider snapshot.',
      );
    }
    if (
      input.storageMode === 'provider-reference' &&
      (input.providerReference === undefined || input.providerReference === '')
    ) {
      throw new ProviderEvidenceError(
        'Provider-reference storage mode requires a provider reference.',
      );
    }

    const revision = await this.client.tripRevision.findFirst({
      where: {
        id: input.tripRevisionId,
        carrierId: this.context.carrierId,
      },
      select: { id: true },
    });
    if (revision === null) {
      throw new TenantObjectNotFoundError(
        'Trip revision was not found in the requested carrier account.',
      );
    }

    if (input.routeId !== undefined) {
      await assertOwnedOptionalReference(
        this.client.route.findFirst({
          where: { id: input.routeId, carrierId: this.context.carrierId },
          select: { id: true },
        }),
        'Route',
      );
    }

    const responseHash =
      input.responseHash === undefined
        ? hashJson({
            providerName: input.providerName,
            providerVersion: input.providerVersion ?? null,
            providerRequestId: input.providerRequestId ?? null,
            rawResponse: input.rawResponse ?? null,
            normalizedSnapshot: input.normalizedSnapshot ?? null,
            providerReference: input.providerReference ?? null,
          })
        : assertSha256(input.responseHash, 'responseHash');

    return this.client.routeProviderResponse.create({
      data: {
        carrierId: this.context.carrierId,
        tripRevisionId: input.tripRevisionId,
        routeId: input.routeId,
        providerName: input.providerName,
        providerVersion: input.providerVersion,
        providerRequestId: input.providerRequestId,
        receivedAt: toDate(input.receivedAt),
        storageMode: input.storageMode,
        licenseAllowsRawStorage: input.licenseAllowsRawStorage,
        rawResponse: asOptionalInputJson(input.rawResponse, 'rawResponse'),
        normalizedSnapshot: asOptionalInputJson(
          input.normalizedSnapshot,
          'normalizedSnapshot',
        ),
        providerReference: input.providerReference,
        responseHash,
      },
    });
  }
}

export interface CreateRegulatoryRuleInput {
  readonly jurisdictionCode: string;
  readonly ruleType: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly sourceTitle: string;
  readonly sourceReference: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly lastVerifiedAt: UtcInstant;
  readonly active: boolean;
  readonly ruleDefinition: Readonly<Record<string, unknown>>;
}

export interface CreateRegulatoryRuleSetInput {
  readonly name: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly sourceTitle: string;
  readonly sourceReference: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly lastVerifiedAt: UtcInstant;
  readonly rules: readonly CreateRegulatoryRuleInput[];
  readonly reason: string;
}

export class RegulatoryRuleRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async createRuleSet(
    input: CreateRegulatoryRuleSetInput,
  ): Promise<Prisma.RegulatoryRuleSetGetPayload<{ include: { rules: true } }>> {
    await assertTenantMembership(this.client, this.context);

    return this.client.$transaction(async (transaction) => {
      const ruleSet = await transaction.regulatoryRuleSet.create({
        data: {
          carrierId: this.context.carrierId,
          name: input.name,
          version: input.version,
          status: 'draft',
          effectiveFrom: toDate(input.effectiveFrom),
          effectiveTo:
            input.effectiveTo === undefined
              ? undefined
              : toDate(input.effectiveTo),
          sourceTitle: input.sourceTitle,
          sourceReference: input.sourceReference,
          sourceMetadata: asInputJson(
            input.sourceMetadata,
            'sourceMetadata',
          ),
          lastVerifiedAt: toDate(input.lastVerifiedAt),
          rules: {
            create: input.rules.map((rule, index) => ({
              carrierId: this.context.carrierId,
              jurisdictionCode: rule.jurisdictionCode,
              ruleType: rule.ruleType,
              version: rule.version,
              effectiveFrom: toDate(rule.effectiveFrom),
              effectiveTo:
                rule.effectiveTo === undefined
                  ? undefined
                  : toDate(rule.effectiveTo),
              sourceTitle: rule.sourceTitle,
              sourceReference: rule.sourceReference,
              sourceMetadata: asInputJson(
                rule.sourceMetadata,
                `rules[${index}].sourceMetadata`,
              ),
              lastVerifiedAt: toDate(rule.lastVerifiedAt),
              active: rule.active,
              ruleDefinition: asInputJson(
                rule.ruleDefinition,
                `rules[${index}].ruleDefinition`,
              ),
            })),
          },
        },
        include: { rules: true },
      });

      await transaction.regulatoryRuleChange.create({
        data: {
          carrierId: this.context.carrierId,
          ruleSetId: ruleSet.id,
          changedByUserId: this.context.actorUserId,
          action: 'created',
          afterSnapshot: asInputJson(
            {
              name: ruleSet.name,
              version: ruleSet.version,
              status: ruleSet.status,
              ruleCount: ruleSet.rules.length,
            },
            'regulatoryRuleChange.afterSnapshot',
          ),
          reason: input.reason,
        },
      });

      return ruleSet;
    });
  }

  public async setRuleSetStatus(
    ruleSetId: string,
    status: 'draft' | 'active' | 'inactive',
    reason: string,
  ): Promise<Prisma.RegulatoryRuleSetGetPayload<Record<string, never>>> {
    await assertTenantMembership(this.client, this.context);

    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.regulatoryRuleSet.findFirst({
        where: { id: ruleSetId, carrierId: this.context.carrierId },
      });
      if (existing === null) {
        throw new TenantObjectNotFoundError(
          'Regulatory rule set was not found in the requested carrier account.',
        );
      }

      if (status === 'active') {
        await transaction.regulatoryRuleSet.updateMany({
          where: {
            carrierId: this.context.carrierId,
            name: existing.name,
            status: 'active',
            NOT: { id: existing.id },
          },
          data: { status: 'inactive' },
        });
      }

      const updated = await transaction.regulatoryRuleSet.update({
        where: { id: existing.id },
        data: { status },
      });

      await transaction.regulatoryRuleChange.create({
        data: {
          carrierId: this.context.carrierId,
          ruleSetId: existing.id,
          changedByUserId: this.context.actorUserId,
          action: 'status-changed',
          beforeSnapshot: asInputJson(
            { status: existing.status },
            'regulatoryRuleChange.beforeSnapshot',
          ),
          afterSnapshot: asInputJson(
            { status: updated.status },
            'regulatoryRuleChange.afterSnapshot',
          ),
          reason,
        },
      });

      await transaction.auditEvent.create({
        data: {
          carrierId: this.context.carrierId,
          actorUserId: this.context.actorUserId,
          entityType: 'regulatory-rule-set',
          entityId: existing.id,
          action: 'status-changed',
          metadata: asInputJson(
            { from: existing.status, to: updated.status, reason },
            'audit.metadata',
          ),
        },
      });

      return updated;
    });
  }
}

export interface RecordExportInput {
  readonly tripRevisionId: string;
  readonly format: string;
  readonly contentHash: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export class ExportHistoryRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async record(
    input: RecordExportInput,
  ): Promise<Prisma.ExportHistoryGetPayload<Record<string, never>>> {
    await assertTenantMembership(this.client, this.context);
    const revision = await this.client.tripRevision.findFirst({
      where: {
        id: input.tripRevisionId,
        carrierId: this.context.carrierId,
      },
      select: { id: true },
    });
    if (revision === null) {
      throw new TenantObjectNotFoundError(
        'Trip revision was not found in the requested carrier account.',
      );
    }

    return this.client.exportHistory.create({
      data: {
        carrierId: this.context.carrierId,
        tripRevisionId: input.tripRevisionId,
        generatedByUserId: this.context.actorUserId,
        format: input.format,
        contentHash: assertSha256(input.contentHash, 'contentHash'),
        metadata: asInputJson(input.metadata, 'metadata'),
      },
    });
  }
}

export function snapshotObject(value: unknown): JsonObject {
  return toJsonObject(value);
}
