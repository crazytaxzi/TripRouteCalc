import {
  EquipmentValidationError,
  EtaSimulationError,
  HosValidationError,
  StopValidationError,
} from '@trip-route-calc/foundation';
import {
  IdempotencyConflictError,
  TenantAccessError,
  TenantObjectNotFoundError,
} from '@trip-route-calc/persistence';
import { CommercialRoutingProviderError } from '@trip-route-calc/routing';
import Fastify from 'fastify';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';

import type { Stage17ApplicationService } from './application.js';
import {
  CalculateTripBodySchema,
  CreateDriverBodySchema,
  CreateLoadBodySchema,
  CreateStopBodySchema,
  CreateTractorBodySchema,
  CreateTrailerBodySchema,
  CreateTripBodySchema,
  DeleteStopBodySchema,
  IdempotencyKeySchema,
  PatchStopBodySchema,
  PatchTripBodySchema,
  RegulationVersionQuerySchema,
  ReorderStopsBodySchema,
  RevisionListQuerySchema,
  TripPathSchema,
  TripStopPathSchema,
  ValidateRouteBodySchema,
} from './contracts.js';
import {
  ApiConflictError,
  ApiError,
  ApiProviderUnavailableError,
  ApiRateLimitError,
  ApiValidationError,
} from './errors.js';
import { stage17OpenApiDocument } from './openapi.js';
import type { RateLimiter } from './rate-limit.js';
import type {
  AuthenticatedPrincipal,
  BearerAuthenticator,
} from './security.js';

export interface Stage17ApiServerDependencies {
  readonly application: Stage17ApplicationService;
  readonly authenticator: BearerAuthenticator;
  readonly rateLimiter: RateLimiter;
  readonly logger?: boolean;
}

function idempotencyKey(request: FastifyRequest): string {
  const raw = request.headers['idempotency-key'];
  if (Array.isArray(raw)) {
    throw new ApiValidationError(
      'Exactly one idempotency-key header is required.',
    );
  }
  return IdempotencyKeySchema.parse(raw);
}

function sendOperation(
  reply: FastifyReply,
  operation: Readonly<{
    statusCode: number;
    body: Readonly<Record<string, unknown>>;
  }>,
): FastifyReply {
  return reply.code(operation.statusCode).send(operation.body);
}

function rateLimitedPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticator: BearerAuthenticator,
  rateLimiter: RateLimiter,
): AuthenticatedPrincipal {
  const principal = authenticator.authenticate(request.headers.authorization);
  const decision = rateLimiter.consume(
    `${principal.carrierId}:${principal.actorUserId}:${principal.tokenId}`,
  );
  reply.header('x-ratelimit-limit', String(decision.limit));
  reply.header('x-ratelimit-remaining', String(decision.remaining));
  reply.header('x-ratelimit-reset', String(decision.resetAtEpochSeconds));
  if (!decision.allowed) {
    throw new ApiRateLimitError('The API rate limit has been exceeded.', {
      limit: decision.limit,
      remaining: decision.remaining,
      resetAtEpochSeconds: decision.resetAtEpochSeconds,
    });
  }
  return principal;
}

function validationError(error: ZodError): ApiValidationError {
  return new ApiValidationError('The request did not satisfy the API contract.', {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  });
}

function mappedError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof TenantAccessError) {
    return new ApiError(403, 'AUTHORIZATION_FAILED', error.message, {}, {
      cause: error,
    });
  }
  if (error instanceof TenantObjectNotFoundError) {
    return new ApiError(404, 'RESOURCE_NOT_FOUND', error.message, {}, {
      cause: error,
    });
  }
  if (error instanceof IdempotencyConflictError) {
    return new ApiConflictError(
      'IDEMPOTENCY_CONFLICT',
      error.message,
      { reason: error.reason },
      { cause: error },
    );
  }
  if (error instanceof CommercialRoutingProviderError) {
    return new ApiProviderUnavailableError(
      error.message,
      {
        providerCode: error.code,
        retryable: error.retryable,
        retryAfterMs: error.retryAfterMs ?? null,
      },
      { cause: error },
    );
  }
  if (error instanceof EquipmentValidationError) {
    return new ApiValidationError(
      'Equipment input failed domain validation.',
      { issues: error.issues },
      { cause: error },
    );
  }
  if (error instanceof HosValidationError) {
    return new ApiValidationError(
      'HOS input failed domain validation.',
      { issues: error.issues },
      { cause: error },
    );
  }
  if (error instanceof StopValidationError) {
    return new ApiValidationError(
      'Stop input failed domain validation.',
      { issues: error.issues },
      { cause: error },
    );
  }
  if (error instanceof EtaSimulationError) {
    return new ApiValidationError(
      error.message,
      { simulatorCode: error.code },
      { cause: error },
    );
  }
  if (error instanceof RangeError || error instanceof TypeError) {
    return new ApiValidationError(error.message, {}, { cause: error });
  }
  return new ApiError(
    500,
    'INTERNAL_FAILURE',
    'The request failed inside the TripRouteCalc API.',
  );
}

export function createStage17Api(
  dependencies: Stage17ApiServerDependencies,
): FastifyInstance {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    routerOptions: { maxParamLength: 512 },
    ajv: { customOptions: { removeAdditional: false } },
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped = mappedError(error);
    if (mapped.statusCode >= 500) request.log.error(error);
    void reply.code(mapped.statusCode).send({
      requestId: request.id,
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
      },
    });
  });

  app.get('/openapi.json', async (_request, reply) =>
    reply.code(200).send(stage17OpenApiDocument()),
  );

  app.post('/api/drivers', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.createDriver(
        principal,
        CreateDriverBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/trips', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.createTrip(
        principal,
        CreateTripBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.get('/api/trips/:tripId', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.getTrip(principal, params.tripId),
    );
  });

  app.patch('/api/trips/:tripId', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.patchTrip(
        principal,
        params.tripId,
        PatchTripBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/trips/:tripId/stops', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.addStop(
        principal,
        params.tripId,
        CreateStopBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/trips/:tripId/stops/reorder', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.reorderStops(
        principal,
        params.tripId,
        ReorderStopsBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.patch('/api/trips/:tripId/stops/:stopId', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripStopPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.patchStop(
        principal,
        params.tripId,
        params.stopId,
        PatchStopBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.delete('/api/trips/:tripId/stops/:stopId', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripStopPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.deleteStop(
        principal,
        params.tripId,
        params.stopId,
        DeleteStopBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/trips/:tripId/calculate', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.calculateTrip(
        principal,
        params.tripId,
        CalculateTripBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.get('/api/trips/:tripId/revisions', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.listRevisions(
        principal,
        params.tripId,
        RevisionListQuerySchema.parse(request.query),
      ),
    );
  });

  app.get('/api/trips/:tripId/timeline', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.getTimeline(principal, params.tripId),
    );
  });

  app.get('/api/trips/:tripId/compliance', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.application.getCompliance(principal, params.tripId),
    );
  });

  app.post('/api/equipment/tractors', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.createTractor(
        principal,
        CreateTractorBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/equipment/trailers', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.createTrailer(
        principal,
        CreateTrailerBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/equipment/loads', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.createLoad(
        principal,
        CreateLoadBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.post('/api/routes/validate', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.validateRoute(
        principal,
        ValidateRouteBodySchema.parse(request.body),
      ),
    );
  });

  app.get('/api/regulations/version', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies.authenticator,
      dependencies.rateLimiter,
    );
    return sendOperation(
      reply,
      await dependencies.application.getRegulationVersion(
        principal,
        RegulationVersionQuerySchema.parse(request.query),
      ),
    );
  });

  return app;
}
