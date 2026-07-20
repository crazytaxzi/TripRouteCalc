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
