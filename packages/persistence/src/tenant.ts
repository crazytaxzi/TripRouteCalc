import type { PersistenceClient } from './client.js';
import { TenantAccessError } from './errors.js';

export interface TenantContext {
  readonly carrierId: string;
  readonly actorUserId: string;
}

export async function assertTenantMembership(
  client: PersistenceClient,
  context: TenantContext,
): Promise<void> {
  const membership = await client.carrierMembership.findUnique({
    where: {
      carrierId_userId: {
        carrierId: context.carrierId,
        userId: context.actorUserId,
      },
    },
    select: { carrierId: true },
  });

  if (membership === null) {
    throw new TenantAccessError(
      'The authenticated user is not a member of the requested carrier account.',
    );
  }
}
