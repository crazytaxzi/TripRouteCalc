import {
  ApiIdempotencyRepository,
  EquipmentProfileRepository,
  IdempotencyConflictError,
  TenantObjectNotFoundError,
  assertTenantMembership,
  snapshotObject,
} from '@trip-route-calc/persistence';
import type {
  PersistenceClient,
  TenantContext,
} from '@trip-route-calc/persistence';

import type { ApplicationOperationResult } from './application.js';
import type { UpdateDriverProfileBody } from './profile-contracts.js';
import { ApiConflictError, ApiError } from './errors.js';
import type { AuthenticatedPrincipal } from './security.js';
import { PublicIdCodec } from './security.js';

export interface Stage18ProfileServiceDependencies {
  readonly client: PersistenceClient;
  readonly publicIds: PublicIdCodec;
}

interface PersistedProfileRecord {
  readonly id: string;
  readonly profile: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

type EquipmentKind = 'tractor' | 'trailer' | 'load';

function tenantContext(principal: AuthenticatedPrincipal): TenantContext {
  return {
    carrierId: principal.carrierId,
    actorUserId: principal.actorUserId,
  };
}

export interface Stage18ProfileOperation {
  listDrivers(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult>;
  updateDriver(
    principal: AuthenticatedPrincipal,
    publicDriverId: string,
    body: UpdateDriverProfileBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult>;
  listTractors(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult>;
  updateTractor(
    principal: AuthenticatedPrincipal,
    publicTractorId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult>;
  listTrailers(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult>;
  updateTrailer(
    principal: AuthenticatedPrincipal,
    publicTrailerId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult>;
  listLoads(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult>;
  updateLoad(
    principal: AuthenticatedPrincipal,
    publicLoadId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult>;
}

export class Stage18ProfileService implements Stage18ProfileOperation {
  readonly #client: PersistenceClient;
  readonly #publicIds: PublicIdCodec;

  public constructor(dependencies: Stage18ProfileServiceDependencies) {
    this.#client = dependencies.client;
    this.#publicIds = dependencies.publicIds;
  }

  public async listDrivers(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    await assertTenantMembership(this.#client, context);
    const drivers = await this.#client.driver.findMany({
      where: { carrierId: context.carrierId },
      orderBy: [{ displayName: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      statusCode: 200,
      body: snapshotObject({
        drivers: drivers.map((driver) => ({
          driverId: this.#publicIds.encode('driver', driver.id),
          displayName: driver.displayName,
          createdAt: driver.createdAt.toISOString(),
          updatedAt: driver.updatedAt.toISOString(),
        })),
      }),
    };
  }

  public async updateDriver(
    principal: AuthenticatedPrincipal,
    publicDriverId: string,
    body: UpdateDriverProfileBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const driverId = this.#publicIds.decode(publicDriverId, 'driver');
    return this.#idempotent(
      context,
      'driver.update',
      idempotencyKey,
      { driverId: publicDriverId, ...body },
      async (): Promise<ApplicationOperationResult> => {
        await assertTenantMembership(this.#client, context);
        const existing = await this.#client.driver.findFirst({
          where: { id: driverId, carrierId: context.carrierId },
          select: { id: true },
        });
        if (existing === null) {
          throw new ApiError(
            404,
            'RESOURCE_NOT_FOUND',
            'Driver was not found in the authenticated carrier account.',
          );
        }
        const driver = await this.#client.driver.update({
          where: { id: driverId },
          data: { displayName: body.displayName },
        });
        await this.#client.auditEvent.create({
          data: {
            carrierId: context.carrierId,
            actorUserId: context.actorUserId,
            entityType: 'driver',
            entityId: driver.id,
            action: 'update',
            metadata: { displayName: driver.displayName },
          },
        });
        return {
          statusCode: 200,
          body: snapshotObject({
            driverId: this.#publicIds.encode('driver', driver.id),
            displayName: driver.displayName,
            createdAt: driver.createdAt.toISOString(),
            updatedAt: driver.updatedAt.toISOString(),
          }),
        };
      },
    );
  }

  public async listTractors(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const records = await new EquipmentProfileRepository(
      this.#client,
      context,
    ).listTractors();
    return this.#equipmentListBody('tractor', records);
  }

  public async updateTractor(
    principal: AuthenticatedPrincipal,
    publicTractorId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#updateEquipment(
      tenantContext(principal),
      'tractor',
      publicTractorId,
      profile,
      idempotencyKey,
    );
  }

  public async listTrailers(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const records = await new EquipmentProfileRepository(
      this.#client,
      context,
    ).listTrailers();
    return this.#equipmentListBody('trailer', records);
  }

  public async updateTrailer(
    principal: AuthenticatedPrincipal,
    publicTrailerId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#updateEquipment(
      tenantContext(principal),
      'trailer',
      publicTrailerId,
      profile,
      idempotencyKey,
    );
  }

  public async listLoads(
    principal: AuthenticatedPrincipal,
  ): Promise<ApplicationOperationResult> {
    const context = tenantContext(principal);
    const records = await new EquipmentProfileRepository(
      this.#client,
      context,
    ).listLoads();
    return this.#equipmentListBody('load', records);
  }

  public async updateLoad(
    principal: AuthenticatedPrincipal,
    publicLoadId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    return this.#updateEquipment(
      tenantContext(principal),
      'load',
      publicLoadId,
      profile,
      idempotencyKey,
    );
  }

  #equipmentListBody(
    kind: EquipmentKind,
    records: readonly PersistedProfileRecord[],
  ): ApplicationOperationResult {
    const collection =
      kind === 'tractor' ? 'tractors' : kind === 'trailer' ? 'trailers' : 'loads';
    return {
      statusCode: 200,
      body: snapshotObject({
        [collection]: records.map((record) =>
          this.#publicEquipment(kind, record),
        ),
      }),
    };
  }

  #publicEquipment(
    kind: EquipmentKind,
    record: PersistedProfileRecord,
  ): Readonly<Record<string, unknown>> {
    return {
      [`${kind}Id`]: this.#publicIds.encode(kind, record.id),
      profile: record.profile,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async #updateEquipment(
    context: TenantContext,
    kind: EquipmentKind,
    publicId: string,
    profile: unknown,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult> {
    const id = this.#publicIds.decode(publicId, kind);
    return this.#idempotent(
      context,
      `equipment.${kind}.update`,
      idempotencyKey,
      { publicId, profile },
      async (): Promise<ApplicationOperationResult> => {
        const repository = new EquipmentProfileRepository(this.#client, context);
        const record: PersistedProfileRecord =
          kind === 'tractor'
            ? await repository.updateTractor(id, profile)
            : kind === 'trailer'
              ? await repository.updateTrailer(id, profile)
              : await repository.updateLoad(id, profile);
        return {
          statusCode: 200,
          body: snapshotObject(this.#publicEquipment(kind, record)),
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
      return { statusCode: claim.responseStatus, body: claim.response };
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
}
