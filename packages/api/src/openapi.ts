export function stage17OpenApiDocument(): Readonly<Record<string, unknown>> {
  const errorResponse = {
    description: 'Structured API error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  };
  const authenticated = [{ bearerAuth: [] }];
  const idempotencyHeader = {
    name: 'idempotency-key',
    in: 'header',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 256 },
  };
  const tripParameter = {
    name: 'tripId',
    in: 'path',
    required: true,
    schema: { type: 'string' },
  };
  const stopParameter = {
    name: 'stopId',
    in: 'path',
    required: true,
    schema: { type: 'string' },
  };
  const jsonBody = (schema: Readonly<Record<string, unknown>>) => ({
    required: true,
    content: { 'application/json': { schema } },
  });

  return Object.freeze({
    openapi: '3.1.0',
    info: {
      title: 'TripRouteCalc API',
      version: '17.0.0',
      description:
        'Authenticated, tenant-scoped CMV trip planning API. It is a planning tool, not an ELD or a legal authority.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/openapi.json': {
        get: {
          operationId: 'getOpenApiDocument',
          responses: {
            '200': {
              description: 'OpenAPI 3.1 document',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
      '/api/trips': {
        post: {
          operationId: 'createTrip',
          security: authenticated,
          parameters: [idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['driverId'],
            properties: {
              driverId: { type: 'string' },
              ruleSetVersion: { type: 'string', default: 'unselected' },
            },
          }),
          responses: {
            '201': { description: 'Trip and initial immutable revision created' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}': {
        get: {
          operationId: 'getTrip',
          security: authenticated,
          parameters: [tripParameter],
          responses: {
            '200': { description: 'Current trip revision and setup' },
            '401': errorResponse,
            '404': errorResponse,
          },
        },
        patch: {
          operationId: 'patchTrip',
          security: authenticated,
          parameters: [tripParameter, idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['expectedRevisionNumber'],
            properties: {
              expectedRevisionNumber: { type: 'integer', minimum: 0 },
              tractorId: { type: ['string', 'null'] },
              trailerId: { type: ['string', 'null'] },
              loadId: { type: ['string', 'null'] },
              driverHosStateId: { type: ['string', 'null'] },
              ruleSetVersion: { type: 'string' },
            },
          }),
          responses: {
            '200': { description: 'New immutable trip revision' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/stops': {
        post: {
          operationId: 'createTripStop',
          security: authenticated,
          parameters: [tripParameter, idempotencyHeader],
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '201': { description: 'Stop added on a new immutable revision' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/stops/{stopId}': {
        patch: {
          operationId: 'patchTripStop',
          security: authenticated,
          parameters: [tripParameter, stopParameter, idempotencyHeader],
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '200': { description: 'Stop changed on a new immutable revision' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
        delete: {
          operationId: 'deleteTripStop',
          security: authenticated,
          parameters: [tripParameter, stopParameter, idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['expectedRevisionNumber'],
            properties: {
              expectedRevisionNumber: { type: 'integer', minimum: 0 },
            },
          }),
          responses: {
            '200': { description: 'Stop removed on a new immutable revision' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/stops/reorder': {
        post: {
          operationId: 'reorderTripStops',
          security: authenticated,
          parameters: [tripParameter, idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['expectedRevisionNumber', 'stopIds'],
            properties: {
              expectedRevisionNumber: { type: 'integer', minimum: 0 },
              stopIds: {
                type: 'array',
                minItems: 1,
                uniqueItems: true,
                items: { type: 'string' },
              },
            },
          }),
          responses: {
            '200': { description: 'Stops reordered on a new immutable revision' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/calculate': {
        post: {
          operationId: 'calculateTrip',
          security: authenticated,
          parameters: [tripParameter, idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['expectedRevisionNumber', 'simulation'],
            properties: {
              expectedRevisionNumber: { type: 'integer', minimum: 0 },
              simulation: { type: 'object' },
            },
          }),
          responses: {
            '201': { description: 'Structured trip calculation persisted' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
            '422': {
              description: 'Structured legal or verification block',
              content: {
                'application/json': {
                  example: {
                    blocking: {
                      code: 'LEGAL_BLOCKING_FINDING',
                      reasons: ['Required commercial evidence is unavailable.'],
                      confidence: 'UNVERIFIED',
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/trips/{tripId}/revisions': {
        get: {
          operationId: 'listTripRevisions',
          security: authenticated,
          parameters: [
            tripParameter,
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            {
              name: 'beforeRevisionNumber',
              in: 'query',
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '200': { description: 'Immutable revision summaries' },
            '401': errorResponse,
            '404': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/timeline': {
        get: {
          operationId: 'getTripTimeline',
          security: authenticated,
          parameters: [tripParameter],
          responses: {
            '200': { description: 'Current structured ETA timeline' },
            '401': errorResponse,
            '404': errorResponse,
          },
        },
      },
      '/api/trips/{tripId}/compliance': {
        get: {
          operationId: 'getTripCompliance',
          security: authenticated,
          parameters: [tripParameter],
          responses: {
            '200': { description: 'Current warnings and regulatory evidence' },
            '401': errorResponse,
            '404': errorResponse,
          },
        },
      },
      '/api/drivers': {
        post: {
          operationId: 'createDriver',
          security: authenticated,
          parameters: [idempotencyHeader],
          requestBody: jsonBody({
            type: 'object',
            additionalProperties: false,
            required: ['displayName'],
            properties: { displayName: { type: 'string' } },
          }),
          responses: {
            '201': { description: 'Driver created' },
            '400': errorResponse,
            '401': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/equipment/tractors': {
        post: {
          operationId: 'createTractor',
          security: authenticated,
          parameters: [idempotencyHeader],
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '201': { description: 'Validated tractor profile created' },
            '400': errorResponse,
            '401': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/equipment/trailers': {
        post: {
          operationId: 'createTrailer',
          security: authenticated,
          parameters: [idempotencyHeader],
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '201': { description: 'Validated trailer profile created' },
            '400': errorResponse,
            '401': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/equipment/loads': {
        post: {
          operationId: 'createLoad',
          security: authenticated,
          parameters: [idempotencyHeader],
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '201': { description: 'Validated load profile created' },
            '400': errorResponse,
            '401': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/routes/validate': {
        post: {
          operationId: 'validateCommercialRoute',
          security: authenticated,
          requestBody: jsonBody({ type: 'object' }),
          responses: {
            '200': { description: 'Usable normalized commercial route' },
            '400': errorResponse,
            '401': errorResponse,
            '422': { description: 'Structured prohibited or unverified route' },
            '503': errorResponse,
          },
        },
      },
      '/api/regulations/version': {
        get: {
          operationId: 'getRegulationVersion',
          security: authenticated,
          parameters: [
            { name: 'name', in: 'query', required: true, schema: { type: 'string' } },
            {
              name: 'at',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
            },
          ],
          responses: {
            '200': { description: 'Active rule-set version and source evidence' },
            '400': errorResponse,
            '401': errorResponse,
            '404': errorResponse,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'TRC-HMAC' },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['error', 'requestId'],
          properties: {
            requestId: { type: 'string' },
            error: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'message', 'details'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
    },
  });
}
