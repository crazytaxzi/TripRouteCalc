import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import type { ApplicationOperationResult } from './application.js';
import {
  IdempotencyKeySchema,
  PlanTripBodySchema,
  TripPathSchema,
} from './contracts.js';
import { ApiRateLimitError, ApiValidationError } from './errors.js';
import { stage18OpenApiDocument } from './stage18-openapi.js';
import type { Stage18PlanningOperation } from './stage18-planning.js';
import type { RateLimiter } from './rate-limit.js';
import type {
  AuthenticatedPrincipal,
  BearerAuthenticator,
} from './security.js';
import { createStage17Api } from './server.js';
import type { Stage17ApiServerDependencies } from './server.js';

export interface Stage18PlanningRouteDependencies {
  readonly planning: Stage18PlanningOperation;
  readonly authenticator: BearerAuthenticator;
  readonly rateLimiter: RateLimiter;
}

export interface Stage18ApiServerDependencies
  extends Stage17ApiServerDependencies,
    Stage18PlanningRouteDependencies {}

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
  operation: ApplicationOperationResult,
): FastifyReply {
  return reply.code(operation.statusCode).send(operation.body);
}

function rateLimitedPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: Stage18PlanningRouteDependencies,
): AuthenticatedPrincipal {
  const principal = dependencies.authenticator.authenticate(
    request.headers.authorization,
  );
  const decision = dependencies.rateLimiter.consume(
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

export function registerStage18PlanningRoutes(
  app: FastifyInstance,
  dependencies: Stage18PlanningRouteDependencies,
): FastifyInstance {
  app.get('/openapi-stage18.json', async (_request, reply) =>
    reply.code(200).send(stage18OpenApiDocument()),
  );

  app.post('/api/trips/:tripId/plan', async (request, reply) => {
    const principal = rateLimitedPrincipal(
      request,
      reply,
      dependencies,
    );
    const params = TripPathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.planning.planTrip(
        principal,
        params.tripId,
        PlanTripBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  return app;
}

export function createStage18Api(
  dependencies: Stage18ApiServerDependencies,
): FastifyInstance {
  return registerStage18PlanningRoutes(
    createStage17Api(dependencies),
    dependencies,
  );
}
