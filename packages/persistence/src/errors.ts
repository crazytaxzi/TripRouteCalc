export class PersistenceConfigurationError extends Error {
  public override readonly name = 'PersistenceConfigurationError';
}

export class TenantAccessError extends Error {
  public override readonly name = 'TenantAccessError';
}

export class TenantObjectNotFoundError extends Error {
  public override readonly name = 'TenantObjectNotFoundError';
}

export class ImmutableSnapshotError extends Error {
  public override readonly name = 'ImmutableSnapshotError';
}

export class ProviderEvidenceError extends Error {
  public override readonly name = 'ProviderEvidenceError';
}

export class TripRevisionConflictError extends Error {
  public override readonly name = 'TripRevisionConflictError';

  public constructor(
    message: string,
    public readonly expectedRevisionNumber?: number,
    public readonly actualRevisionNumber?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class IdempotencyConflictError extends Error {
  public override readonly name = 'IdempotencyConflictError';

  public constructor(
    message: string,
    public readonly reason: 'REQUEST_MISMATCH' | 'IN_PROGRESS',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
