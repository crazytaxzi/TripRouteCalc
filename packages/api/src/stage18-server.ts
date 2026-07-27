import type { FastifyInstance } from 'fastify';

import { TripPathSchema } from './contracts.js';
import { stage18OpenApiDocument } from './stage18-openapi.js';
import { Stage18PlanTripBodySchema } from './stage18-plan-contract.js';
import type { Stage18PlanningOperation } from './stage18-planning.js';
import { registerStage18ProfileRoutes } from './stage18-profile-routes.js';
import type { Stage18ProfileRouteDependencies } from './stage18-profile-routes.js';
import {
  sendStage18Operation,
  stage18IdempotencyKey,
  stage18Principal,
} from './stage18-route-support.js';
import type { Stage18AuthenticatedRouteDependencies } from './stage18-route-support.js';
import { createStage17Api } from './server.js';
import type { Stage17ApiServerDependencies } from './server.js';

export interface Stage18PlanningRouteDependencies
  extends Stage18AuthenticatedRouteDependencies {
  readonly planning: Stage18PlanningOperation;
}

export interface Stage18ApiServerDependencies
  extends Stage17ApiServerDependencies,
    Stage18PlanningRouteDependencies,
    Stage18ProfileRouteDependencies {}

export function registerStage18PlanningRoutes(
  app: FastifyInstance,
  dependencies: Stage18PlanningRouteDependencies,
): FastifyInstance {
  app.get('/openapi-stage18.json', async (_request, reply) =>
    reply.code(200).send(stage18OpenApiDocument()),
  );

  app.post('/api/trips/:tripId/plan', async (request, reply) => {
    const principal = stage18Principal(request, reply, dependencies);
    const params = TripPathSchema.parse(request.params);
    return sendStage18Operation(
      reply,
      await dependencies.planning.planTrip(
        principal,
        params.tripId,
        Stage18PlanTripBodySchema.parse(request.body),
        stage18IdempotencyKey(request),
      ),
    );
  });

  return app;
}

export function createStage18Api(
  dependencies: Stage18ApiServerDependencies,
): FastifyInstance {
  const app = createStage17Api(dependencies);
  registerStage18ProfileRoutes(app, dependencies);
  return registerStage18PlanningRoutes(app, dependencies);
}
