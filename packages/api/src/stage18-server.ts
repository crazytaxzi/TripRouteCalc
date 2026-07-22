import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import type { ApplicationOperationResult } from './application.js';
import {
  CreateLoadBodySchema,
  CreateTractorBodySchema,
  CreateTrailerBodySchema,
  IdempotencyKeySchema,
} from './contracts.js';
import { ApiRateLimitError, ApiValidationError } from './errors.js';
import {
  DriverProfilePathSchema,
  LoadProfilePathSchema,
  TractorProfilePathSchema,
  TrailerProfilePathSchema,
  UpdateDriverProfileBodySchema,
} from './profile-contracts.js';
import { stage18ProfileOpenApiDocument } from './profile-openapi.js';
import type { Stage18ProfileService } from './profile-service.js';
import type { AuthenticatedPrincipal } from './security.js';
import {
  createStage17Api,
} from './server.js';
import type { Stage17ApiServerDependencies } from './server.js';

export interface Stage18ApiServerDependencies
  extends Stage17ApiServerDependencies {
  readonly profiles: Stage18ProfileService;
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

function principal(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: Stage18ApiServerDependencies,
): AuthenticatedPrincipal {
  const authenticated = dependencies.authenticator.authenticate(
    request.headers.authorization,
  );
  const decision = dependencies.rateLimiter.consume(
    `${authenticated.carrierId}:${authenticated.actorUserId}:${authenticated.tokenId}`,
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
  return authenticated;
}

function sendOperation(
  reply: FastifyReply,
  operation: ApplicationOperationResult,
): FastifyReply {
  return reply.code(operation.statusCode).send(operation.body);
}

export function createStage18Api(
  dependencies: Stage18ApiServerDependencies,
): FastifyInstance {
  const app = createStage17Api(dependencies);

  app.get('/openapi-stage18.json', async (_request, reply) =>
    reply.code(200).send(stage18ProfileOpenApiDocument()),
  );

  app.get('/api/drivers', async (request, reply) =>
    sendOperation(
      reply,
      await dependencies.profiles.listDrivers(
        principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/drivers/:driverId', async (request, reply) => {
    const authenticated = principal(request, reply, dependencies);
    const params = DriverProfilePathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.profiles.updateDriver(
        authenticated,
        params.driverId,
        UpdateDriverProfileBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/tractors', async (request, reply) =>
    sendOperation(
      reply,
      await dependencies.profiles.listTractors(
        principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/tractors/:tractorId', async (request, reply) => {
    const authenticated = principal(request, reply, dependencies);
    const params = TractorProfilePathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.profiles.updateTractor(
        authenticated,
        params.tractorId,
        CreateTractorBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/trailers', async (request, reply) =>
    sendOperation(
      reply,
      await dependencies.profiles.listTrailers(
        principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/trailers/:trailerId', async (request, reply) => {
    const authenticated = principal(request, reply, dependencies);
    const params = TrailerProfilePathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.profiles.updateTrailer(
        authenticated,
        params.trailerId,
        CreateTrailerBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/loads', async (request, reply) =>
    sendOperation(
      reply,
      await dependencies.profiles.listLoads(
        principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/loads/:loadId', async (request, reply) => {
    const authenticated = principal(request, reply, dependencies);
    const params = LoadProfilePathSchema.parse(request.params);
    return sendOperation(
      reply,
      await dependencies.profiles.updateLoad(
        authenticated,
        params.loadId,
        CreateLoadBodySchema.parse(request.body),
        idempotencyKey(request),
      ),
    );
  });

  return app;
}
