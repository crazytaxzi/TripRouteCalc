import type { FastifyInstance } from 'fastify';

import {
  CreateLoadBodySchema,
  CreateTractorBodySchema,
  CreateTrailerBodySchema,
} from './contracts.js';
import {
  DriverProfilePathSchema,
  LoadProfilePathSchema,
  TractorProfilePathSchema,
  TrailerProfilePathSchema,
  UpdateDriverProfileBodySchema,
} from './profile-contracts.js';
import type { Stage18ProfileOperation } from './profile-service.js';
import {
  sendStage18Operation,
  stage18IdempotencyKey,
  stage18Principal,
} from './stage18-route-support.js';
import type { Stage18AuthenticatedRouteDependencies } from './stage18-route-support.js';

export interface Stage18ProfileRouteDependencies
  extends Stage18AuthenticatedRouteDependencies {
  readonly profiles: Stage18ProfileOperation;
}

export function registerStage18ProfileRoutes(
  app: FastifyInstance,
  dependencies: Stage18ProfileRouteDependencies,
): FastifyInstance {
  app.get('/api/drivers', async (request, reply) =>
    sendStage18Operation(
      reply,
      await dependencies.profiles.listDrivers(
        stage18Principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/drivers/:driverId', async (request, reply) => {
    const principal = stage18Principal(request, reply, dependencies);
    const params = DriverProfilePathSchema.parse(request.params);
    return sendStage18Operation(
      reply,
      await dependencies.profiles.updateDriver(
        principal,
        params.driverId,
        UpdateDriverProfileBodySchema.parse(request.body),
        stage18IdempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/tractors', async (request, reply) =>
    sendStage18Operation(
      reply,
      await dependencies.profiles.listTractors(
        stage18Principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/tractors/:tractorId', async (request, reply) => {
    const principal = stage18Principal(request, reply, dependencies);
    const params = TractorProfilePathSchema.parse(request.params);
    return sendStage18Operation(
      reply,
      await dependencies.profiles.updateTractor(
        principal,
        params.tractorId,
        CreateTractorBodySchema.parse(request.body),
        stage18IdempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/trailers', async (request, reply) =>
    sendStage18Operation(
      reply,
      await dependencies.profiles.listTrailers(
        stage18Principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/trailers/:trailerId', async (request, reply) => {
    const principal = stage18Principal(request, reply, dependencies);
    const params = TrailerProfilePathSchema.parse(request.params);
    return sendStage18Operation(
      reply,
      await dependencies.profiles.updateTrailer(
        principal,
        params.trailerId,
        CreateTrailerBodySchema.parse(request.body),
        stage18IdempotencyKey(request),
      ),
    );
  });

  app.get('/api/equipment/loads', async (request, reply) =>
    sendStage18Operation(
      reply,
      await dependencies.profiles.listLoads(
        stage18Principal(request, reply, dependencies),
      ),
    ),
  );

  app.patch('/api/equipment/loads/:loadId', async (request, reply) => {
    const principal = stage18Principal(request, reply, dependencies);
    const params = LoadProfilePathSchema.parse(request.params);
    return sendStage18Operation(
      reply,
      await dependencies.profiles.updateLoad(
        principal,
        params.loadId,
        CreateLoadBodySchema.parse(request.body),
        stage18IdempotencyKey(request),
      ),
    );
  });

  return app;
}
