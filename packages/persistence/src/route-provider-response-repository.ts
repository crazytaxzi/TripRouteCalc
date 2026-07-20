import {
  assessCommercialRoute,
  commercialRouteResultSnapshot,
} from '@trip-route-calc/foundation';
import type {
  NormalizedCommercialRouteResult,
  UtcInstant,
} from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import {
  ProviderEvidenceError,
  TenantObjectNotFoundError,
} from './errors.js';
import { hashJson } from './json.js';
import type { Prisma } from './generated/prisma/client.js';
import {
  PRISMA_PROVIDER_STORAGE_MODES,
  asInputJson,
  assertOwnedOptionalReference,
  assertSha256,
  toDate,
} from './repository-shared.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

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

export interface SaveNormalizedCommercialRouteEvidenceInput {
  readonly tripRevisionId: string;
  readonly routeId?: string;
  readonly receivedAt: UtcInstant;
  readonly result: NormalizedCommercialRouteResult;
  readonly retention:
    | Readonly<{
        mode: 'normalized-snapshot';
        normalizedSnapshotRetentionAllowed: true;
      }>
    | Readonly<{
        mode: 'provider-reference';
        providerReference: string;
      }>;
}

export class RouteProviderResponseRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async saveNormalizedCommercialRouteEvidence(
    input: SaveNormalizedCommercialRouteEvidenceInput,
  ): Promise<Prisma.RouteProviderResponseGetPayload<Record<string, never>>> {
    const result = assessCommercialRoute(input.result);
    const common = {
      tripRevisionId: input.tripRevisionId,
      ...(input.routeId === undefined ? {} : { routeId: input.routeId }),
      providerName: result.provider.providerName,
      ...(result.provider.providerVersion === undefined
        ? {}
        : { providerVersion: result.provider.providerVersion }),
      ...(result.provider.providerRequestId === undefined
        ? {}
        : { providerRequestId: result.provider.providerRequestId }),
      receivedAt: input.receivedAt,
      licenseAllowsRawStorage: false,
    };

    if (input.retention.mode === 'normalized-snapshot') {
      return this.save({
        ...common,
        storageMode: 'normalized-snapshot',
        normalizedSnapshot: commercialRouteResultSnapshot(result),
      });
    }

    return this.save({
      ...common,
      storageMode: 'provider-reference',
      providerReference: input.retention.providerReference,
    });
  }

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
        routeId: input.routeId ?? null,
        providerName: input.providerName,
        providerVersion: input.providerVersion ?? null,
        providerRequestId: input.providerRequestId ?? null,
        receivedAt: toDate(input.receivedAt),
        storageMode: PRISMA_PROVIDER_STORAGE_MODES[input.storageMode],
        licenseAllowsRawStorage: input.licenseAllowsRawStorage,
        ...(input.rawResponse === undefined
          ? {}
          : { rawResponse: asInputJson(input.rawResponse, 'rawResponse') }),
        ...(input.normalizedSnapshot === undefined
          ? {}
          : {
              normalizedSnapshot: asInputJson(
                input.normalizedSnapshot,
                'normalizedSnapshot',
              ),
            }),
        providerReference: input.providerReference ?? null,
        responseHash,
      },
    });
  }
}
