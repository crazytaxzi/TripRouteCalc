import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ApplicationOperationResult } from './application.js';
import { IdempotencyKeySchema } from './contracts.js';
import { ApiRateLimitError, ApiValidationError } from './errors.js';
import type { RateLimiter } from './rate-limit.js';
import type {
  AuthenticatedPrincipal,
  BearerAuthenticator,
} from './security.js';

export interface Stage18AuthenticatedRouteDependencies {
  readonly authenticator: BearerAuthenticator;
  readonly rateLimiter: RateLimiter;
}

export function stage18IdempotencyKey(request: FastifyRequest): string {
  const raw = request.headers['idempotency-key'];
  if (Array.isArray(raw)) {
    throw new ApiValidationError(
      'Exactly one idempotency-key header is required.',
    );
  }
  return IdempotencyKeySchema.parse(raw);
}

export function sendStage18Operation(
  reply: FastifyReply,
  operation: ApplicationOperationResult,
): FastifyReply {
  return reply.code(operation.statusCode).send(operation.body);
}

export function stage18Principal(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: Stage18AuthenticatedRouteDependencies,
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
