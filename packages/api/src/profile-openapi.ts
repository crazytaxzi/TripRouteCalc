export function stage18ProfileOpenApiDocument(): Readonly<
  Record<string, unknown>
> {
  const authenticated = [{ bearerAuth: [] }];
  const errorResponse = { description: 'Structured TripRouteCalc API error' };
  const idempotencyHeader = {
    name: 'idempotency-key',
    in: 'header',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 256 },
  };
  const identifier = (name: string): Readonly<Record<string, unknown>> => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 512 },
  });
  const updateOperation = (
    operationId: string,
    identifierName: string,
    description: string,
  ): Readonly<Record<string, unknown>> => ({
    operationId,
    security: authenticated,
    parameters: [identifier(identifierName), idempotencyHeader],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: { type: 'object' } },
      },
    },
    responses: {
      '200': { description },
      '400': errorResponse,
      '401': errorResponse,
      '404': errorResponse,
      '409': errorResponse,
      '429': errorResponse,
    },
  });
  const listOperation = (
    operationId: string,
    description: string,
  ): Readonly<Record<string, unknown>> => ({
    operationId,
    security: authenticated,
    responses: {
      '200': { description },
      '401': errorResponse,
      '429': errorResponse,
    },
  });

  return Object.freeze({
    openapi: '3.1.0',
    info: {
      title: 'TripRouteCalc Stage 18 Profile API Extension',
      version: '18.0.0',
      description:
        'Tenant-scoped reusable driver, tractor, trailer, and load profile listing and editing. Creation remains documented in the Stage 17 API document.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/api/drivers': {
        get: listOperation('listDrivers', 'Carrier driver profiles'),
      },
      '/api/drivers/{driverId}': {
        patch: updateOperation(
          'updateDriver',
          'driverId',
          'Updated driver profile',
        ),
      },
      '/api/equipment/tractors': {
        get: listOperation('listTractors', 'Carrier tractor profiles'),
      },
      '/api/equipment/tractors/{tractorId}': {
        patch: updateOperation(
          'updateTractor',
          'tractorId',
          'Updated tractor profile',
        ),
      },
      '/api/equipment/trailers': {
        get: listOperation('listTrailers', 'Carrier trailer profiles'),
      },
      '/api/equipment/trailers/{trailerId}': {
        patch: updateOperation(
          'updateTrailer',
          'trailerId',
          'Updated trailer profile',
        ),
      },
      '/api/equipment/loads': {
        get: listOperation('listLoads', 'Carrier load profiles'),
      },
      '/api/equipment/loads/{loadId}': {
        patch: updateOperation('updateLoad', 'loadId', 'Updated load profile'),
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'TRC-HMAC' },
      },
    },
  });
}
