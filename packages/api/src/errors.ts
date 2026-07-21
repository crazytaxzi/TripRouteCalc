export const API_ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_INVALID',
  'AUTHORIZATION_FAILED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'LEGAL_BLOCKING_FINDING',
  'MANUAL_VERIFICATION_REQUIRED',
  'INTERNAL_FAILURE',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class ApiError extends Error {
  public override readonly name = 'ApiError';

  public constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ApiAuthenticationError extends ApiError {
  public override readonly name = 'ApiAuthenticationError';

  public constructor(
    code: Extract<ApiErrorCode, 'AUTHENTICATION_REQUIRED' | 'AUTHENTICATION_INVALID'>,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(401, code, message, details, options);
  }
}

export class ApiAuthorizationError extends ApiError {
  public override readonly name = 'ApiAuthorizationError';

  public constructor(
    message = 'The authenticated principal is not authorized for this operation.',
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(403, 'AUTHORIZATION_FAILED', message, details, options);
  }
}

export class ApiValidationError extends ApiError {
  public override readonly name = 'ApiValidationError';

  public constructor(
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(400, 'VALIDATION_FAILED', message, details, options);
  }
}

export class ApiConflictError extends ApiError {
  public override readonly name = 'ApiConflictError';

  public constructor(
    code: Extract<ApiErrorCode, 'REVISION_CONFLICT' | 'IDEMPOTENCY_CONFLICT'>,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(409, code, message, details, options);
  }
}

export class ApiRateLimitError extends ApiError {
  public override readonly name = 'ApiRateLimitError';

  public constructor(
    message: string,
    details: Readonly<Record<string, unknown>>,
  ) {
    super(429, 'RATE_LIMITED', message, details);
  }
}

export class ApiProviderUnavailableError extends ApiError {
  public override readonly name = 'ApiProviderUnavailableError';

  public constructor(
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(503, 'PROVIDER_UNAVAILABLE', message, details, options);
  }
}

export class ApiLegalBlockingError extends ApiError {
  public override readonly name = 'ApiLegalBlockingError';

  public constructor(
    code: Extract<
      ApiErrorCode,
      'LEGAL_BLOCKING_FINDING' | 'MANUAL_VERIFICATION_REQUIRED'
    >,
    message: string,
    details: Readonly<Record<string, unknown>>,
  ) {
    super(422, code, message, details);
  }
}
