import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import type { Prisma } from './generated/prisma/client.js';
import { asInputJson, assertSha256 } from './repository-shared.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

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
