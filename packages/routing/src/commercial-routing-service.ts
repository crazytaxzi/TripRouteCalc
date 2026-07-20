import {
  CommercialLocationInputSchema,
  ResolvedCommercialLocationSchema,
  assessCommercialRoute,
  validateCommercialRouteRequest,
} from '@trip-route-calc/foundation';
import type {
  CommercialLocationInput,
  CommercialRouteRequest,
  CommercialRouteRestriction,
  NormalizedCommercialRouteResult,
  ResolvedCommercialLocation,
  RoadClosure,
  RoadClosureRequest,
  TrafficEstimate,
  TrafficEstimateRequest,
} from '@trip-route-calc/foundation';

export const COMMERCIAL_ROUTING_ERROR_CODES = [
  'PROVIDER_NOT_SELECTED',
  'CREDENTIAL_REQUIRED',
  'LICENSE_CONFIGURATION_INVALID',
  'CAPABILITY_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_OUTAGE',
  'NETWORK_FAILURE',
  'REQUEST_REJECTED',
  'INVALID_PROVIDER_RESPONSE',
] as const;
export type CommercialRoutingErrorCode =
  (typeof COMMERCIAL_ROUTING_ERROR_CODES)[number];

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function safeMessage(value: unknown): string {
  if (value instanceof Error && value.message.trim() !== '') {
    return value.message.replaceAll(
      /(?:api[-_ ]?key|token|secret|credential)\s*[=:]\s*\S+/giu,
      '[REDACTED]',
    );
  }
  return 'The commercial-routing provider operation failed.';
}

export class CommercialRoutingProviderError extends Error {
  public override readonly name = 'CommercialRoutingProviderError';

  public constructor(
    public readonly code: CommercialRoutingErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly providerName?: string,
    public readonly retryAfterMs?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ServerOnlyProviderCredential {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  public static fromServerConfiguration(
    value: unknown,
  ): ServerOnlyProviderCredential {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new CommercialRoutingProviderError(
        'CREDENTIAL_REQUIRED',
        'A non-empty server-only provider credential is required.',
        false,
      );
    }
    return new ServerOnlyProviderCredential(value);
  }

  public use<Result>(callback: (credential: string) => Result): Result {
    return callback(this.#value);
  }

  public toString(): string {
    return '[REDACTED]';
  }

  public toJSON(): string {
    return '[REDACTED]';
  }
}

export interface ProviderLicenseCapabilities {
  readonly rawResponseRetention: 'allowed' | 'forbidden' | 'unknown';
  readonly normalizedSnapshotRetention: 'allowed' | 'forbidden' | 'unknown';
  readonly providerReferenceRetention: 'allowed' | 'forbidden' | 'unknown';
  readonly commercialVehicleRoutingLicensed: boolean;
  readonly coverageDescription: string;
}

export interface CommercialRouteProviderMetadata {
  readonly name: string;
  readonly version?: string;
  readonly credentialRequirement: 'required' | 'none';
  readonly capabilities: Readonly<{
    geocoding: boolean;
    commercialRouting: boolean;
    routeRestrictions: boolean;
    trafficEstimate: boolean;
    roadClosures: boolean;
    consumerComparison: boolean;
  }>;
}

export interface CommercialRouteProviderContext {
  readonly signal: AbortSignal;
  readonly credential?: ServerOnlyProviderCredential;
  readonly operationRequestId: string;
}

export interface CommercialRouteProvider {
  readonly metadata: CommercialRouteProviderMetadata;
  geocodeLocation(
    input: CommercialLocationInput,
    context: CommercialRouteProviderContext,
  ): Promise<unknown>;
  calculateCommercialRoute(
    request: CommercialRouteRequest,
    context: CommercialRouteProviderContext,
  ): Promise<unknown>;
  getRouteRestrictions(
    routeId: string,
    context: CommercialRouteProviderContext,
  ): Promise<readonly CommercialRouteRestriction[]>;
  getTrafficEstimate?(
    request: TrafficEstimateRequest,
    context: CommercialRouteProviderContext,
  ): Promise<TrafficEstimate>;
  getRoadClosures?(
    request: RoadClosureRequest,
    context: CommercialRouteProviderContext,
  ): Promise<readonly RoadClosure[]>;
  calculateConsumerComparison?(
    request: CommercialRouteRequest,
    context: CommercialRouteProviderContext,
  ): Promise<unknown>;
}

export interface CommercialRoutingExecutionPolicy {
  readonly timeoutMs: number;
  readonly maximumAttempts: 1 | 2 | 3;
  readonly initialRetryDelayMs: number;
  readonly maximumRetryDelayMs: number;
}

export const DEFAULT_COMMERCIAL_ROUTING_EXECUTION_POLICY: CommercialRoutingExecutionPolicy =
  freeze({
    timeoutMs: 15_000,
    maximumAttempts: 3,
    initialRetryDelayMs: 250,
    maximumRetryDelayMs: 2_000,
  });

export interface CommercialRoutingRuntimeConfig {
  readonly provider?: CommercialRouteProvider;
  readonly credential?: ServerOnlyProviderCredential;
  readonly license?: ProviderLicenseCapabilities;
  readonly executionPolicy?: CommercialRoutingExecutionPolicy;
}

export interface CommercialRoutingSetupBlocker {
  readonly code:
    | 'PROVIDER_NOT_SELECTED'
    | 'CREDENTIAL_REQUIRED'
    | 'LICENSE_CONFIGURATION_INVALID';
  readonly explanation: string;
  readonly missingSetup: readonly string[];
}

export type CommercialRoutingRuntime =
  | Readonly<{
      status: 'ready';
      service: CommercialRoutingService;
      provider: CommercialRouteProviderMetadata;
      license: ProviderLicenseCapabilities;
    }>
  | Readonly<{
      status: 'blocked';
      blocker: CommercialRoutingSetupBlocker;
    }>;

export interface CommercialRoutingExecutionDependencies {
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly createAbortController: () => AbortController;
}

const DEFAULT_EXECUTION_DEPENDENCIES: CommercialRoutingExecutionDependencies =
  freeze({
    sleep: async (milliseconds: number): Promise<void> => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      });
    },
    createAbortController: (): AbortController => new AbortController(),
  });

function normalizePolicy(
  input: CommercialRoutingExecutionPolicy | undefined,
): CommercialRoutingExecutionPolicy {
  const policy = input ?? DEFAULT_COMMERCIAL_ROUTING_EXECUTION_POLICY;
  if (!Number.isSafeInteger(policy.timeoutMs) || policy.timeoutMs <= 0) {
    throw new RangeError(
      'Commercial-routing timeout must be a positive safe integer.',
    );
  }
  if (![1, 2, 3].includes(policy.maximumAttempts)) {
    throw new RangeError(
      'Commercial-routing attempts must be between one and three.',
    );
  }
  if (
    !Number.isSafeInteger(policy.initialRetryDelayMs) ||
    policy.initialRetryDelayMs < 0 ||
    !Number.isSafeInteger(policy.maximumRetryDelayMs) ||
    policy.maximumRetryDelayMs < policy.initialRetryDelayMs
  ) {
    throw new RangeError('Commercial-routing retry delays are invalid.');
  }
  return freeze({ ...policy });
}

function providerError(
  error: unknown,
  providerName: string,
): CommercialRoutingProviderError {
  if (error instanceof CommercialRoutingProviderError) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new CommercialRoutingProviderError(
      'TIMEOUT',
      `The ${providerName} operation exceeded its configured timeout.`,
      true,
      providerName,
      undefined,
      { cause: error },
    );
  }
  return new CommercialRoutingProviderError(
    'NETWORK_FAILURE',
    safeMessage(error),
    true,
    providerName,
    undefined,
    { cause: error },
  );
}

export class CommercialRoutingService {
  readonly #policy: CommercialRoutingExecutionPolicy;
  readonly #dependencies: CommercialRoutingExecutionDependencies;

  public constructor(
    readonly provider: CommercialRouteProvider,
    readonly license: ProviderLicenseCapabilities,
    readonly credential?: ServerOnlyProviderCredential,
    executionPolicy?: CommercialRoutingExecutionPolicy,
    dependencies: CommercialRoutingExecutionDependencies =
      DEFAULT_EXECUTION_DEPENDENCIES,
  ) {
    this.#policy = normalizePolicy(executionPolicy);
    this.#dependencies = dependencies;
  }

  public async geocodeLocation(
    input: unknown,
    operationRequestId: string,
  ): Promise<ResolvedCommercialLocation> {
    if (!this.provider.metadata.capabilities.geocoding) {
      throw this.capabilityError('geocoding');
    }
    const parsed = CommercialLocationInputSchema.parse(input);
    const response = await this.execute(
      'geocode',
      operationRequestId,
      (context) => this.provider.geocodeLocation(parsed, context),
    );
    return freeze(ResolvedCommercialLocationSchema.parse(response));
  }

  public async calculateCommercialRoute(
    requestInput: unknown,
  ): Promise<NormalizedCommercialRouteResult> {
    if (!this.provider.metadata.capabilities.commercialRouting) {
      throw this.capabilityError('commercial routing');
    }
    const request = validateCommercialRouteRequest(requestInput);
    const response = await this.execute(
      'commercial-route',
      request.requestId,
      (context) => this.provider.calculateCommercialRoute(request, context),
    );
    let normalized: NormalizedCommercialRouteResult;
    try {
      normalized = assessCommercialRoute(response);
    } catch (error) {
      throw new CommercialRoutingProviderError(
        'INVALID_PROVIDER_RESPONSE',
        'The commercial-routing provider returned a response that does not satisfy the normalized contract.',
        false,
        this.provider.metadata.name,
        undefined,
        { cause: error },
      );
    }
    if (normalized.routeKind !== 'commercial-vehicle') {
      throw new CommercialRoutingProviderError(
        'INVALID_PROVIDER_RESPONSE',
        'A commercial-route request returned a consumer comparison. Silent consumer fallback is forbidden.',
        false,
        this.provider.metadata.name,
      );
    }
    return normalized;
  }

  public async calculateConsumerComparison(
    requestInput: unknown,
  ): Promise<NormalizedCommercialRouteResult> {
    if (
      !this.provider.metadata.capabilities.consumerComparison ||
      this.provider.calculateConsumerComparison === undefined
    ) {
      throw this.capabilityError('consumer route comparison');
    }
    const request = validateCommercialRouteRequest(requestInput);
    const calculateComparison = this.provider.calculateConsumerComparison.bind(
      this.provider,
    );
    const response = await this.execute(
      'consumer-comparison',
      request.requestId,
      (context) => calculateComparison(request, context),
    );
    const normalized = assessCommercialRoute(response);
    if (normalized.routeKind !== 'consumer-comparison') {
      throw new CommercialRoutingProviderError(
        'INVALID_PROVIDER_RESPONSE',
        'The comparison operation did not return a separately labeled consumer route.',
        false,
        this.provider.metadata.name,
      );
    }
    return normalized;
  }

  public async getRouteRestrictions(
    routeId: string,
    operationRequestId: string,
  ): Promise<readonly CommercialRouteRestriction[]> {
    if (!this.provider.metadata.capabilities.routeRestrictions) {
      throw this.capabilityError('route restrictions');
    }
    const restrictions = await this.execute(
      'route-restrictions',
      operationRequestId,
      (context) => this.provider.getRouteRestrictions(routeId, context),
    );
    return freezeArray(restrictions);
  }

  public async getTrafficEstimate(
    request: TrafficEstimateRequest,
    operationRequestId: string,
  ): Promise<TrafficEstimate> {
    if (
      !this.provider.metadata.capabilities.trafficEstimate ||
      this.provider.getTrafficEstimate === undefined
    ) {
      throw this.capabilityError('traffic estimate');
    }
    const getTrafficEstimate = this.provider.getTrafficEstimate.bind(
      this.provider,
    );
    return this.execute('traffic-estimate', operationRequestId, (context) =>
      getTrafficEstimate(request, context),
    );
  }

  public async getRoadClosures(
    request: RoadClosureRequest,
    operationRequestId: string,
  ): Promise<readonly RoadClosure[]> {
    if (
      !this.provider.metadata.capabilities.roadClosures ||
      this.provider.getRoadClosures === undefined
    ) {
      throw this.capabilityError('road closures');
    }
    const getRoadClosures = this.provider.getRoadClosures.bind(this.provider);
    const closures = await this.execute(
      'road-closures',
      operationRequestId,
      (context) => getRoadClosures(request, context),
    );
    return freezeArray(closures);
  }

  private capabilityError(capability: string): CommercialRoutingProviderError {
    return new CommercialRoutingProviderError(
      'CAPABILITY_UNAVAILABLE',
      `${this.provider.metadata.name} is not configured for ${capability}.`,
      false,
      this.provider.metadata.name,
    );
  }

  private async execute<Result>(
    operationName: string,
    operationRequestId: string,
    operation: (context: CommercialRouteProviderContext) => Promise<Result>,
  ): Promise<Result> {
    let lastError: CommercialRoutingProviderError | undefined;
    for (
      let attempt = 1;
      attempt <= this.#policy.maximumAttempts;
      attempt += 1
    ) {
      const controller = this.#dependencies.createAbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutFailure = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new CommercialRoutingProviderError(
              'TIMEOUT',
              `The ${this.provider.metadata.name} operation exceeded its configured timeout.`,
              true,
              this.provider.metadata.name,
            ),
          );
        }, this.#policy.timeoutMs);
      });
      try {
        const providerOperation = operation(
          freeze({
            signal: controller.signal,
            ...(this.credential === undefined
              ? {}
              : { credential: this.credential }),
            operationRequestId: `${operationRequestId}:${operationName}:${String(attempt)}`,
          }),
        );
        return await Promise.race([providerOperation, timeoutFailure]);
      } catch (error) {
        const mapped = providerError(error, this.provider.metadata.name);
        lastError = mapped;
        if (!mapped.retryable || attempt >= this.#policy.maximumAttempts) {
          throw mapped;
        }
        const exponentialDelay = Math.min(
          this.#policy.maximumRetryDelayMs,
          this.#policy.initialRetryDelayMs * 2 ** (attempt - 1),
        );
        const delay = Math.min(
          this.#policy.maximumRetryDelayMs,
          mapped.retryAfterMs ?? exponentialDelay,
        );
        await this.#dependencies.sleep(delay);
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }
    throw (
      lastError ??
      new CommercialRoutingProviderError(
        'PROVIDER_OUTAGE',
        'The commercial-routing provider did not return a result.',
        true,
        this.provider.metadata.name,
      )
    );
  }
}

export function createCommercialRoutingRuntime(
  config: CommercialRoutingRuntimeConfig,
): CommercialRoutingRuntime {
  if (config.provider === undefined) {
    return freeze({
      status: 'blocked' as const,
      blocker: freeze({
        code: 'PROVIDER_NOT_SELECTED' as const,
        explanation:
          'No licensed commercial-routing provider has been selected. Live CMV route verification is blocked and no consumer fallback is permitted.',
        missingSetup: freezeArray([
          'Select a licensed commercial-routing provider with United States CMV coverage.',
          'Document provider licensing, retention rights, coverage, and known data limitations.',
          'Supply server-side credentials without exposing them to client code or logs.',
        ]),
      }),
    });
  }

  if (
    config.license === undefined ||
    !config.license.commercialVehicleRoutingLicensed
  ) {
    return freeze({
      status: 'blocked' as const,
      blocker: freeze({
        code: 'LICENSE_CONFIGURATION_INVALID' as const,
        explanation:
          'The selected provider does not have documented commercial-vehicle routing licensing for this runtime.',
        missingSetup: freezeArray([
          'Confirm commercial-vehicle routing entitlement.',
          'Record allowed raw, normalized, and provider-reference retention modes.',
          'Record geographic and restriction-data coverage.',
        ]),
      }),
    });
  }

  if (
    config.provider?.metadata.credentialRequirement === 'required' &&
    config.credential === undefined
  ) {
    return freeze({
      status: 'blocked' as const,
      blocker: freeze({
        code: 'CREDENTIAL_REQUIRED' as const,
        explanation:
          'The selected commercial-routing provider requires a server-side credential that is not configured.',
        missingSetup: freezeArray([
          'Provision the provider credential in a server-only secret store.',
          'Inject the credential into the routing runtime without serializing or logging it.',
        ]),
      }),
    });
  }

  const service = new CommercialRoutingService(
    config.provider,
    config.license,
    config.credential,
    config.executionPolicy,
  );
  return freeze({
    status: 'ready' as const,
    service,
    provider: config.provider.metadata,
    license: config.license,
  });
}
