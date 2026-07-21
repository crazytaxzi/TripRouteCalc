import { randomUUID } from 'node:crypto';

import {
  TripStopPlanSchema,
  etaSimulationSnapshot,
  simulateEtaTrip,
  utcInstant,
} from '@trip-route-calc/foundation';
import type {
  EtaSimulationInput,
  EtaSimulationResult,
  StopServiceDurationPlan,
  TripStopPlan,
} from '@trip-route-calc/foundation';
import {
  ApiIdempotencyRepository,
  EquipmentProfileRepository,
  IdempotencyConflictError,
  RegulatoryRuleRepository,
  TenantObjectNotFoundError,
  TripRevisionRepository,
  assertTenantMembership,
  snapshotObject,
} from '@trip-route-calc/persistence';
import type {
  CreateTripRevisionInput,
  PersistedTrip,
  PersistedTripRevision,
  PersistenceClient,
  TenantContext,
} from '@trip-route-calc/persistence';
import type { CommercialRoutingRuntime } from '@trip-route-calc/routing';
import { CommercialRoutingProviderError } from '@trip-route-calc/routing';
import { z } from 'zod';

import type {
  CalculateTripBody,
  CreateDriverBody,
  CreateStopBody,
  CreateTripBody,
  DeleteStopBody,
  PatchStopBody,
  PatchTripBody,
  RegulationVersionQuery,
  ReorderStopsBody,
  RevisionListQuery,
} from './contracts.js';
import {
  ApiConflictError,
  ApiError,
  ApiLegalBlockingError,
  ApiProviderUnavailableError,
  ApiValidationError,
} from './errors.js';
import type { AuthenticatedPrincipal } from './security.js';
import { PublicIdCodec } from './security.js';

const uuidSchema = z.string().uuid();
const nonEmptyText = z.string().trim().min(1);
const logicalTripStopSchema = TripStopPlanSchema.extend({ id: uuidSchema });
const stage17TripDraftSchema = z
  .object({
    version: z.literal(1),
    driverId: uuidSchema,
    tractorId: uuidSchema.nullable(),
    trailerId: uuidSchema.nullable(),
    loadId: uuidSchema.nullable(),
    driverHosStateId: uuidSchema.nullable(),
    ruleSetVersion: nonEmptyText,
    stops: z.array(logicalTripStopSchema),
  })
  .strict();

export type Stage17TripDraft = Readonly<
  z.infer<typeof stage17TripDraftSchema>
>;

export interface ApplicationOperationResult {
  readonly statusCode: number;
  readonly body: Readonly<Record<string, unknown>>;
}

export interface Stage17ApplicationDependencies {
  readonly client: PersistenceClient;
  readonly publicIds: PublicIdCodec;
  readonly routingRuntime: CommercialRoutingRuntime;
  readonly now?: () => Date;
}

interface CurrentTripState {
  readonly trip: PersistedTrip;
  readonly revision: PersistedTripRevision;
  readonly draft: Stage17TripDraft;
}

function tenantContext(principal: AuthenticatedPrincipal): TenantContext {
  return {
    carrierId: principal.carrierId,
    actorUserId: principal.actorUserId,
  };
}

function expectedServiceDuration(
  plan: StopServiceDurationPlan,
): TripStopPlan['checkInDuration'] {
  switch (plan.mode) {
    case 'exact':
    case 'expected':
    case 'historical-average':
      return plan.duration;
    case 'range':
      return plan.expected;
  }
}

function appointmentWindow(
  stop: TripStopPlan,
): CreateTripRevisionInput['stops'][number]['appointmentWindow'] | undefined {
  switch (stop.appointment.mode) {
    case 'window':
    case 'open-window':
      return stop.appointment.window;
    case 'none':
    case 'earliest':
    case 'latest':
    case 'fixed':
      return undefined;
  }
}

function revisionStops(
  stops: readonly TripStopPlan[],
): CreateTripRevisionInput['stops'] {
  return stops.map((stop) => {
    const { id: _id, sequence, type, required, ...details } = stop;
    const window = appointmentWindow(stop);
    return {
      sequence,
      type,
      required,
      timeZone: stop.location.timeZone,
      expectedServiceDuration: expectedServiceDuration(stop.serviceDuration),
      ...(window === undefined ? {} : { appointmentWindow: window }),
      details,
    };
  });
}

function parseDraft(revision: PersistedTripRevision): Stage17TripDraft {
  const parsed = stage17TripDraftSchema.safeParse(revision.inputSnapshot);
  if (!parsed.success) {
    throw new ApiError(
      500,
      'INTERNAL_FAILURE',
      'The current trip revision does not contain a valid Stage 17 draft snapshot.',
      { revisionNumber: revision.revisionNumber },
      { cause: parsed.error },
    );
  }
  return Object.freeze({
    ...parsed.data,
    stops: Object.freeze([...parsed.data.stops]),
  });
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new ApiValidationError(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiValidationError(`${label} must be an array.`);
  }
  return value;
}

function decodePlacementStop(
  value: unknown,
  publicIds: PublicIdCodec,
): unknown {
  const placement = asObject(value, 'placement');
  if (placement.stopId === undefined) return placement;
  if (typeof placement.stopId !== 'string') {
    throw new ApiValidationError('placement.stopId must be a public stop identifier.');
  }
  return {
    ...placement,
    stopId: publicIds.decode(placement.stopId, 'stop'),
  };
}

function simulationWithInternalReferences(
  simulation: Readonly<Record<string, unknown>>,
  draft: Stage17TripDraft,
  revisionReference: string,
  publicIds: PublicIdCodec,
): EtaSimulationInput {
  const route = asObject(simulation.route, 'simulation.route');
  const legs = asArray(route.legs, 'simulation.route.legs').map(
    (legValue, index) => {
      const leg = asObject(
        legValue,
        `simulation.route.legs[${String(index)}]`,
      );
      if (typeof leg.destinationStopId !== 'string') {
        throw new ApiValidationError(
          `simulation.route.legs[${String(index)}].destinationStopId must be a public stop identifier.`,
        );
      }
      const originReferenceId =
        typeof leg.originReferenceId === 'string' &&
        leg.originReferenceId.startsWith('stp.')
          ? publicIds.decode(leg.originReferenceId, 'stop')
          : leg.originReferenceId;
      return {
        ...leg,
        originReferenceId,
        destinationStopId: publicIds.decode(
          leg.destinationStopId,
          'stop',
        ),
      };
    },
  );

  const operationalEvents = asArray(
    simulation.operationalEvents,
    'simulation.operationalEvents',
  ).map((eventValue, index) => {
    const event = asObject(
      eventValue,
      `simulation.operationalEvents[${String(index)}]`,
    );
    return {
      ...event,
      placement: decodePlacementStop(event.placement, publicIds),
    };
  });

  const complianceActions = asArray(
    simulation.complianceActions,
    'simulation.complianceActions',
  ).map((actionValue, index) => {
    const action = asObject(
      actionValue,
      `simulation.complianceActions[${String(index)}]`,
    );
    return {
      ...action,
      placement: decodePlacementStop(action.placement, publicIds),
      ...(action.actionEvent === undefined
        ? {}
        : {
            actionEvent: {
              ...asObject(
                action.actionEvent,
                `simulation.complianceActions[${String(index)}].actionEvent`,
              ),
              placement: decodePlacementStop(
                asObject(
                  action.actionEvent,
                  `simulation.complianceActions[${String(index)}].actionEvent`,
                ).placement,
                publicIds,
              ),
            },
          }),
    };
  });

  return {
    ...(simulation as Omit<EtaSimulationInput, 'route' | 'stops'>),
    route: { ...route, legs } as EtaSimulationInput['route'],
    stops: draft.stops,
    operationalEvents: operationalEvents as EtaSimulationInput['operationalEvents'],
    complianceActions: complianceActions as EtaSimulationInput['complianceActions'],
    revisionReference,
  };
}

function publicizeReferences(
  value: unknown,
  publicIds: PublicIdCodec,
  stopIds: ReadonlySet<string>,
  context?: 'stop',
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      publicizeReferences(entry, publicIds, stopIds, context),
    );
  }
  if (value === null || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (
      typeof child === 'string' &&
      stopIds.has(child) &&
      (key === 'stopId' ||
        key === 'finalStopId' ||
        key === 'destinationStopId' ||
        key === 'originReferenceId' ||
        (context === 'stop' && key === 'id'))
    ) {
      result[key] = publicIds.encode('stop', child);
      continue;
    }
    result[key] = publicizeReferences(
      child,
      publicIds,
      stopIds,
      key === 'stop' ? 'stop' : undefined,
    );
  }
  return result;
}

function publicStop(stop: TripStopPlan, publicIds: PublicIdCodec): unknown {
  return { ...stop, id: publicIds.encode('stop', stop.id) };
}

function optionalPublicId(
  publicIds: PublicIdCodec,
  type: 'tractor' | 'trailer' | 'load' | 'hos-state',
  value: string | null,
): string | null {
  return value === null ? null : publicIds.encode(type, value);
}

export class Stage17ApplicationService {
  readonly #client: PersistenceClient;
  readonly #publicIds: PublicIdCodec;
  readonly #routingRuntime: CommercialRoutingRuntime;
  readonly #now: () => Date;

  public constructor(dependencies: Stage17ApplicationDependencies) {
    this.#client = dependencies.client;
    this.#publicIds = dependencies.publicIds;
    this.#routingRuntime = dependencies.routingRuntime;
    this.#now = dependencies.now ?? (() => new Date());
  }

  public async createDriver(
    principal: AuthenticatedPrincipal,
    body: CreateDriverBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    return this.#idempotent(
      context,
      'driver.create',
      idempotencyKey,
      body,
      async () => {
        await assertTenantMembership(this.#client, context);
        const driver = await this.#client.driver.create({
          data: {
            carrierId: context.carrierId,
            displayName: body.displayName,
          },
        });
        await this.#client.auditEvent.create({
          data: {
            carrierId: context.carrierId,
            actorUserId: context.actorUserId,
            entityType: 'driver',
            entityId: driver.id,
            action: 'create',
            metadata: { displayName: driver.displayName },
          },
        });
        return {
          statusCode: 201,
          body: {
            driverId: this.#publicIds.encode('driver', driver.id),
            displayName: driver.displayName,
            createdAt: driver.createdAt.toISOString(),
          },
        };
      },
    );
  }

  public async createTrip(
    principal: AuthenticatedPrincipal,
    body: CreateTripBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    return this.#idempotent(
      context,
      'trip.create',
      idempotencyKey,
      body,
      async () => {
        await assertTenantMembership(this.#client, context);
        const driverId = this.#publicIds.decode(body.driverId, 'driver');
        const driver = await this.#client.driver.findFirst({
          where: { id: driverId, carrierId: context.carrierId },
          select: { id: true },
        });
        if (driver === null) {
          throw new ApiError(
            404,
            'RESOURCE_NOT_FOUND',
            'Driver was not found in the authenticated carrier account.',
          );
        }
        const trip = await this.#client.trip.create({
          data: { carrierId: context.carrierId, driverId },
        });
        const draft: Stage17TripDraft = Object.freeze({
          version: 1,
          driverId,
          tractorId: null,
          trailerId: null,
          loadId: null,
          driverHosStateId: null,
          ruleSetVersion: body.ruleSetVersion,
          stops: Object.freeze([]),
        });
        try {
          const revision = await new TripRevisionRepository(
            this.#client,
            context,
          ).createRevision(this.#revisionInput(trip.id, draft));
          await this.#client.auditEvent.create({
            data: {
              carrierId: context.carrierId,
              actorUserId: context.actorUserId,
              entityType: 'trip',
              entityId: trip.id,
              action: 'create',
              metadata: { initialRevisionNumber: revision.revisionNumber },
            },
          });
          const current = await this.#loadCurrent(context, trip.id);
          return {
            statusCode: 201,
            body: this.#tripBody(current),
          };
        } catch (error) {
          await this.#client.trip.deleteMany({
            where: { id: trip.id, currentRevisionId: null },
          });
          throw error;
        }
      },
    );
  }

  public async getTrip(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
  ): Promise<ApplicationOperationResult> {
    const state = await this.#loadCurrent(
      tenantContext(principal),
      this.#publicIds.decode(publicTripId, 'trip'),
    );
    return { statusCode: 200, body: this.#tripBody(state) };
  }

  public async patchTrip(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    body: PatchTripBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    return this.#idempotent(
      context,
      'trip.patch',
      idempotencyKey,
      { tripId: publicTripId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        const draft = stage17TripDraftSchema.parse({
          ...current.draft,
          tractorId:
            body.tractorId === undefined
              ? current.draft.tractorId
              : body.tractorId === null
                ? null
                : this.#publicIds.decode(body.tractorId, 'tractor'),
          trailerId:
            body.trailerId === undefined
              ? current.draft.trailerId
              : body.trailerId === null
                ? null
                : this.#publicIds.decode(body.trailerId, 'trailer'),
          loadId:
            body.loadId === undefined
              ? current.draft.loadId
              : body.loadId === null
                ? null
                : this.#publicIds.decode(body.loadId, 'load'),
          driverHosStateId:
            body.driverHosStateId === undefined
              ? current.draft.driverHosStateId
              : body.driverHosStateId === null
                ? null
                : this.#publicIds.decode(body.driverHosStateId, 'hos-state'),
          ruleSetVersion: body.ruleSetVersion ?? current.draft.ruleSetVersion,
        });
        const next = await this.#createRevision(context, current, draft);
        return { statusCode: 200, body: this.#tripBody(next) };
      },
    );
  }

  public async addStop(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    body: CreateStopBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    return this.#idempotent(
      context,
      'trip.stop.create',
      idempotencyKey,
      { tripId: publicTripId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        const stop = logicalTripStopSchema.parse({
          ...body.stop,
          id: randomUUID(),
        });
        const draft = stage17TripDraftSchema.parse({
          ...current.draft,
          stops: [...current.draft.stops, stop],
        });
        const next = await this.#createRevision(context, current, draft);
        return {
          statusCode: 201,
          body: {
            trip: this.#tripBody(next),
            stop: publicStop(stop, this.#publicIds),
          },
        };
      },
    );
  }

  public async patchStop(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    publicStopId: string,
    body: PatchStopBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    const stopId = this.#publicIds.decode(publicStopId, 'stop');
    return this.#idempotent(
      context,
      'trip.stop.patch',
      idempotencyKey,
      { tripId: publicTripId, stopId: publicStopId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        let found = false;
        const stops = current.draft.stops.map((stop) => {
          if (stop.id !== stopId) return stop;
          found = true;
          return logicalTripStopSchema.parse({
            ...stop,
            ...body.patch,
            id: stop.id,
            sequence: stop.sequence,
          });
        });
        if (!found) this.#stopNotFound();
        const draft = stage17TripDraftSchema.parse({
          ...current.draft,
          stops,
        });
        const next = await this.#createRevision(context, current, draft);
        return { statusCode: 200, body: this.#tripBody(next) };
      },
    );
  }

  public async deleteStop(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    publicStopId: string,
    body: DeleteStopBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    const stopId = this.#publicIds.decode(publicStopId, 'stop');
    return this.#idempotent(
      context,
      'trip.stop.delete',
      idempotencyKey,
      { tripId: publicTripId, stopId: publicStopId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        const stops = current.draft.stops.filter((stop) => stop.id !== stopId);
        if (stops.length === current.draft.stops.length) this.#stopNotFound();
        const draft = stage17TripDraftSchema.parse({
          ...current.draft,
          stops,
        });
        const next = await this.#createRevision(context, current, draft);
        return { statusCode: 200, body: this.#tripBody(next) };
      },
    );
  }

  public async reorderStops(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    body: ReorderStopsBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    return this.#idempotent(
      context,
      'trip.stop.reorder',
      idempotencyKey,
      { tripId: publicTripId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        const requestedIds = body.stopIds.map((id) =>
          this.#publicIds.decode(id, 'stop'),
        );
        const currentIds = current.draft.stops.map((stop) => stop.id);
        if (
          requestedIds.length !== currentIds.length ||
          requestedIds.some((id) => !currentIds.includes(id))
        ) {
          throw new ApiValidationError(
            'Stop reorder must contain every current stop exactly once.',
          );
        }
        current.draft.stops.forEach((stop, index) => {
          if (stop.lockedPosition && requestedIds[index] !== stop.id) {
            throw new ApiConflictError(
              'REVISION_CONFLICT',
              'A locked stop cannot be moved by the reorder operation.',
              { stopId: this.#publicIds.encode('stop', stop.id) },
            );
          }
        });
        const byId = new Map(
          current.draft.stops.map((stop) => [stop.id, stop] as const),
        );
        const stops = requestedIds.map((id, index) => {
          const stop = byId.get(id);
          if (stop === undefined) throw new Error('Validated stop disappeared.');
          return logicalTripStopSchema.parse({ ...stop, sequence: index + 1 });
        });
        const draft = stage17TripDraftSchema.parse({
          ...current.draft,
          stops,
        });
        const next = await this.#createRevision(context, current, draft);
        return { statusCode: 200, body: this.#tripBody(next) };
      },
    );
  }

  public async calculateTrip(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    body: CalculateTripBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    return this.#idempotent(
      context,
      'trip.calculate',
      idempotencyKey,
      { tripId: publicTripId, ...body },
      async () => {
        const current = await this.#loadCurrent(context, tripId);
        this.#assertExpectedRevision(current, body.expectedRevisionNumber);
        const result = simulateEtaTrip(
          simulationWithInternalReferences(
            body.simulation,
            current.draft,
            this.#publicIds.encode('revision', current.revision.id),
            this.#publicIds,
          ),
        );
        const next = await this.#createRevision(
          context,
          current,
          current.draft,
          result,
        );
        const publicResult = this.#publicEtaResult(result, current.draft);
        const blocked = result.expected.status === 'BLOCKED';
        return {
          statusCode: blocked ? 422 : 201,
          body: {
            trip: this.#tripBody(next),
            calculation: publicResult,
            ...(blocked
              ? {
                  blocking: {
                    code: 'LEGAL_BLOCKING_FINDING',
                    reasons: result.expected.blockingReasons,
                    confidence: result.expected.confidence,
                    explanations: result.expected.constraintExplanations,
                  },
                }
              : {}),
          },
        };
      },
    );
  }

  public async listRevisions(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    query: RevisionListQuery,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const tripId = this.#publicIds.decode(publicTripId, 'trip');
    await this.#loadCurrent(context, tripId);
    const revisions = await this.#client.tripRevision.findMany({
      where: {
        carrierId: context.carrierId,
        tripId,
        ...(query.beforeRevisionNumber === undefined
          ? {}
          : { revisionNumber: { lt: query.beforeRevisionNumber } }),
      },
      orderBy: { revisionNumber: 'desc' },
      take: query.limit,
      select: {
        id: true,
        revisionNumber: true,
        createdAt: true,
        calculationTimestamp: true,
        contentHash: true,
        resultSnapshot: true,
      },
    });
    return {
      statusCode: 200,
      body: {
        revisions: revisions.map((revision) => ({
          revisionId: this.#publicIds.encode('revision', revision.id),
          revisionNumber: revision.revisionNumber,
          createdAt: revision.createdAt.toISOString(),
          calculationTimestamp: revision.calculationTimestamp.toISOString(),
          contentHash: revision.contentHash,
          calculated: revision.resultSnapshot !== null,
        })),
      },
    };
  }

  public async getTimeline(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
  ): Promise<ApplicationOperationResult> {
    const current = await this.#loadCurrent(
      tenantContext(principal),
      this.#publicIds.decode(publicTripId, 'trip'),
    );
    if (current.revision.resultSnapshot === null) {
      return {
        statusCode: 200,
        body: {
          status: 'not-calculated',
          revisionId: this.#publicIds.encode('revision', current.revision.id),
          timeline: [],
        },
      };
    }
    const result = asObject(
      current.revision.resultSnapshot,
      'revision.resultSnapshot',
    );
    const expected = asObject(result.expected, 'revision.resultSnapshot.expected');
    const stopIds = new Set(current.draft.stops.map((stop) => stop.id));
    return {
      statusCode: 200,
      body: {
        status: expected.status,
        revisionId: this.#publicIds.encode('revision', current.revision.id),
        timeline: publicizeReferences(
          expected.timeline ?? [],
          this.#publicIds,
          stopIds,
        ),
        finalHosClocks: expected.finalHosClocks ?? null,
      },
    };
  }

  public async getCompliance(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
  ): Promise<ApplicationOperationResult> {
    const current = await this.#loadCurrent(
      tenantContext(principal),
      this.#publicIds.decode(publicTripId, 'trip'),
    );
    return {
      statusCode: 200,
      body: {
        revisionId: this.#publicIds.encode('revision', current.revision.id),
        warnings: current.revision.warnings.map((warning) => ({
          code: warning.code,
          severity: warning.severity,
          explanation: warning.explanation,
          sourceReference: warning.sourceReference,
        })),
        ruleEvidence: current.revision.ruleEvidence.map((evidence) => ({
          sourceReference: evidence.sourceReference,
          ruleVersion: evidence.ruleVersion,
          evaluationSnapshot: evidence.evaluationSnapshot,
        })),
        calculationStatus:
          current.revision.resultSnapshot === null ? 'not-calculated' : 'available',
      },
    };
  }

  public async createTractor(
    principal: AuthenticatedPrincipal,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#createEquipment(
      tenantContext(principal),
      'tractor',
      profile,
      idempotencyKey,
    );
  }

  public async createTrailer(
    principal: AuthenticatedPrincipal,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#createEquipment(
      tenantContext(principal),
      'trailer',
      profile,
      idempotencyKey,
    );
  }

  public async createLoad(
    principal: AuthenticatedPrincipal,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#createEquipment(
      tenantContext(principal),
      'load',
      profile,
      idempotencyKey,
    );
  }

  public async validateRoute(
    _principal: AuthenticatedPrincipal,
    request: Readonly<Record<string, unknown>>,
  ): Promise<ApplicationOperationResult> {
    if (this.#routingRuntime.status === 'blocked') {
      throw new ApiProviderUnavailableError(
        this.#routingRuntime.blocker.explanation,
        {
          code: this.#routingRuntime.blocker.code,
          missingSetup: this.#routingRuntime.blocker.missingSetup,
        },
      );
    }
    try {
      const result = await this.#routingRuntime.service.calculateCommercialRoute(
        request,
      );
      const blocked = result.assessment.commercialPlanningStatus === 'blocked';
      return {
        statusCode: blocked ? 422 : 200,
        body: {
          route: result,
          ...(blocked
            ? {
                blocking: {
                  code: 'LEGAL_BLOCKING_FINDING',
                  reasons: result.assessment.blockingReasons,
                },
              }
            : {}),
        },
      };
    } catch (error) {
      if (error instanceof CommercialRoutingProviderError) {
        throw new ApiProviderUnavailableError(
          error.message,
          {
            providerCode: error.code,
            retryable: error.retryable,
            retryAfterMs: error.retryAfterMs ?? null,
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  public async getRegulationVersion(
    principal: AuthenticatedPrincipal,
    query: RegulationVersionQuery,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const evaluationAt = utcInstant(
      query.at ?? this.#now().toISOString(),
    );
    const active = await new RegulatoryRuleRepository(
      this.#client,
      context,
    ).getActiveRuleSet(query.name, evaluationAt);
    if (active === null) {
      throw new ApiError(
        404,
        'RESOURCE_NOT_FOUND',
        'No active regulatory rule set matches the requested name and time.',
      );
    }
    return {
      statusCode: 200,
      body: {
        ruleSetId: this.#publicIds.encode('rule-set', active.databaseId),
        name: active.ruleSet.name,
        version: active.ruleSet.version,
        effectiveFrom: active.ruleSet.effectiveFrom,
        effectiveTo: active.ruleSet.effectiveTo ?? null,
        source: active.ruleSet.source,
        coverage: active.ruleSet.coverage,
      },
    };
  }

  #revisionInput(
    tripId: string,
    draft: Stage17TripDraft,
    result?: EtaSimulationResult,
  ): CreateTripRevisionInput {
    return {
      tripId,
      calculationTimestamp: utcInstant(this.#now().toISOString()),
      ruleSetVersion: draft.ruleSetVersion,
      inputSnapshot: draft,
      stops: revisionStops(draft.stops),
      ...(draft.loadId === null ? {} : { loadId: draft.loadId }),
      ...(draft.tractorId === null ? {} : { tractorId: draft.tractorId }),
      ...(draft.trailerId === null ? {} : { trailerId: draft.trailerId }),
      ...(draft.driverHosStateId === null
        ? {}
        : { driverHosStateId: draft.driverHosStateId }),
      ...(result === undefined
        ? {}
        : {
            result: {
              confidence: result.expected.confidence.toLowerCase() as
                | 'high'
                | 'moderate'
                | 'low'
                | 'unverified',
              confidenceReasons: result.expected.confidenceReasons,
              explanation: result.expected.explanations,
              snapshot: etaSimulationSnapshot(result),
            },
          }),
    };
  }

  async #loadCurrent(
    context: TenantContext,
    tripId: string,
  ): Promise<CurrentTripState> {
    const repository = new TripRevisionRepository(this.#client, context);
    const trip = await repository.getTrip(tripId);
    if (trip === null) {
      throw new ApiError(
        404,
        'RESOURCE_NOT_FOUND',
        'Trip was not found in the authenticated carrier account.',
      );
    }
    if (trip.currentRevisionId === null) {
      throw new ApiError(
        500,
        'INTERNAL_FAILURE',
        'Trip does not have a current immutable revision.',
      );
    }
    const revision = await repository.getRevision(trip.currentRevisionId);
    if (revision === null) {
      throw new ApiError(
        500,
        'INTERNAL_FAILURE',
        'Trip current revision could not be loaded.',
      );
    }
    return { trip, revision, draft: parseDraft(revision) };
  }

  #assertExpectedRevision(
    current: CurrentTripState,
    expectedRevisionNumber: number,
  ): void {
    if (current.revision.revisionNumber !== expectedRevisionNumber) {
      throw new ApiConflictError(
        'REVISION_CONFLICT',
        'The trip changed after the caller loaded it.',
        {
          expectedRevisionNumber,
          actualRevisionNumber: current.revision.revisionNumber,
          currentRevisionId: this.#publicIds.encode(
            'revision',
            current.revision.id,
          ),
        },
      );
    }
  }

  async #createRevision(
    context: TenantContext,
    current: CurrentTripState,
    draft: Stage17TripDraft,
    result?: EtaSimulationResult,
  ): Promise<CurrentTripState> {
    try {
      await new TripRevisionRepository(this.#client, context).createRevision(
        this.#revisionInput(current.trip.id, draft, result),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Trip revision changed concurrently')
      ) {
        throw new ApiConflictError(
          'REVISION_CONFLICT',
          'The trip changed concurrently while the new revision was being committed.',
          { expectedRevisionNumber: current.revision.revisionNumber },
          { cause: error },
        );
      }
      throw error;
    }
    return this.#loadCurrent(context, current.trip.id);
  }

  #tripBody(current: CurrentTripState): Readonly<Record<string, unknown>> {
    return snapshotObject({
      tripId: this.#publicIds.encode('trip', current.trip.id),
      driverId: this.#publicIds.encode('driver', current.draft.driverId),
      createdAt: current.trip.createdAt.toISOString(),
      updatedAt: current.trip.updatedAt.toISOString(),
      currentRevision: {
        revisionId: this.#publicIds.encode('revision', current.revision.id),
        revisionNumber: current.revision.revisionNumber,
        createdAt: current.revision.createdAt.toISOString(),
        calculationTimestamp: current.revision.calculationTimestamp.toISOString(),
        contentHash: current.revision.contentHash,
      },
      equipment: {
        tractorId: optionalPublicId(
          this.#publicIds,
          'tractor',
          current.draft.tractorId,
        ),
        trailerId: optionalPublicId(
          this.#publicIds,
          'trailer',
          current.draft.trailerId,
        ),
        loadId: optionalPublicId(
          this.#publicIds,
          'load',
          current.draft.loadId,
        ),
      },
      driverHosStateId: optionalPublicId(
        this.#publicIds,
        'hos-state',
        current.draft.driverHosStateId,
      ),
      ruleSetVersion: current.draft.ruleSetVersion,
      stops: current.draft.stops
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .map((stop) => publicStop(stop, this.#publicIds)),
      calculationStatus:
        current.revision.resultSnapshot === null ? 'not-calculated' : 'available',
    });
  }

  #publicEtaResult(
    result: EtaSimulationResult,
    draft: Stage17TripDraft,
  ): Readonly<Record<string, unknown>> {
    return snapshotObject(
      publicizeReferences(
        etaSimulationSnapshot(result),
        this.#publicIds,
        new Set(draft.stops.map((stop) => stop.id)),
      ),
    );
  }

  async #createEquipment(
    context: TenantContext,
    kind: 'tractor' | 'trailer' | 'load',
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#idempotent(
      context,
      `equipment.${kind}.create`,
      idempotencyKey,
      profile,
      async () => {
        const repository = new EquipmentProfileRepository(this.#client, context);
        const persisted =
          kind === 'tractor'
            ? await repository.createTractor(profile)
            : kind === 'trailer'
              ? await repository.createTrailer(profile)
              : await repository.createLoad(profile);
        return {
          statusCode: 201,
          body: snapshotObject({
            [`${kind}Id`]: this.#publicIds.encode(kind, persisted.id),
            profile: persisted.profile,
            createdAt: persisted.createdAt.toISOString(),
            updatedAt: persisted.updatedAt.toISOString(),
          }),
        };
      },
    );
  }

  async #idempotent(
    context: TenantContext,
    operation: string,
    key: string,
    request: unknown,
    execute: () => Promise<ApplicationOperationResult>,
  ): Promise<ApplicationOperationResult> {
    const repository = new ApiIdempotencyRepository(this.#client, context);
    let claim;
    try {
      claim = await repository.begin({ operation, key, request });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        throw new ApiConflictError(
          'IDEMPOTENCY_CONFLICT',
          error.message,
          { reason: error.reason },
          { cause: error },
        );
      }
      throw error;
    }
    if (claim.status === 'replay') {
      return {
        statusCode: claim.responseStatus,
        body: claim.response,
      };
    }
    try {
      const result = await execute();
      await repository.complete(claim.recordId, result.statusCode, result.body);
      return result;
    } catch (error) {
      await repository.abandon(claim.recordId);
      if (error instanceof TenantObjectNotFoundError) {
        throw new ApiError(
          404,
          'RESOURCE_NOT_FOUND',
          error.message,
          {},
          { cause: error },
        );
      }
      throw error;
    }
  }

  #stopNotFound(): never {
    throw new ApiError(
      404,
      'RESOURCE_NOT_FOUND',
      'Stop was not found in the current trip revision.',
    );
  }
}
