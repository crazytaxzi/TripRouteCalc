import { stage17OpenApiDocument } from './openapi.js';

function objectValue(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function authenticatedResponses(): Readonly<Record<string, unknown>> {
  return {
    '400': {
      description: 'Structured request or domain validation error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    '401': {
      description: 'Authentication failed',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    '404': {
      description: 'Tenant-scoped resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    '409': {
      description: 'Idempotency or revision conflict',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
  };
}

function idempotencyHeader(): Readonly<Record<string, unknown>> {
  return {
    name: 'idempotency-key',
    in: 'header',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 256 },
  };
}

function profilePath(
  operationPrefix: string,
  idName: string,
  bodySchema: string,
): Readonly<Record<string, unknown>> {
  return {
    patch: {
      operationId: `update${operationPrefix}`,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: idName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        idempotencyHeader(),
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${bodySchema}` },
          },
        },
      },
      responses: {
        '200': { description: `${operationPrefix} updated` },
        ...authenticatedResponses(),
      },
    },
  };
}

export function stage18OpenApiDocument(): Readonly<Record<string, unknown>> {
  const stage17 = stage17OpenApiDocument();
  const info = objectValue(stage17.info, 'OpenAPI info');
  const paths = objectValue(stage17.paths, 'OpenAPI paths');
  const components = objectValue(stage17.components, 'OpenAPI components');
  const schemas = objectValue(components.schemas, 'OpenAPI schemas');

  const planTripRequest = {
    type: 'object',
    additionalProperties: false,
    required: [
      'expectedRevisionNumber',
      'departureAt',
      'departureTimeZone',
      'currentDutyStatus',
      'currentDutyStatusBeganAt',
      'clocks',
      'hos',
      'routePolicy',
      'avoidances',
    ],
    properties: {
      expectedRevisionNumber: { type: 'integer', minimum: 0 },
      departureAt: { type: 'string', format: 'date-time' },
      departureTimeZone: { type: 'string' },
      currentDutyStatus: {
        type: 'string',
        enum: [
          'off_duty',
          'sleeper_berth',
          'driving',
          'on_duty_not_driving',
        ],
      },
      currentDutyStatusBeganAt: { type: 'string', format: 'date-time' },
      clocks: {
        type: 'object',
        additionalProperties: false,
        required: [
          'driveMinutesRemaining',
          'shiftMinutesRemaining',
          'cycleMinutesRemaining',
        ],
        properties: {
          driveMinutesRemaining: { type: 'integer', minimum: 0 },
          shiftMinutesRemaining: { type: 'integer', minimum: 0 },
          cycleMinutesRemaining: { type: 'integer', minimum: 0 },
        },
      },
      hos: {
        type: 'object',
        description:
          'Complete entered HOS departure facts. Legal results and ETA objects are server-owned.',
      },
      routePolicy: {
        type: 'string',
        enum: [
          'fastest-compliant',
          'shortest-compliant',
          'balanced-compliant',
        ],
      },
      avoidances: {
        type: 'array',
        uniqueItems: true,
        items: {
          type: 'string',
          enum: [
            'tolls',
            'ferries',
            'tunnels',
            'uncontrolled-border-crossings',
            'unpaved-roads',
            'seasonal-roads',
            'hazmat-restricted-roads',
            'permit-only-roads',
          ],
        },
      },
    },
  } as const;

  const listOperation = (name: string): Readonly<Record<string, unknown>> => ({
    get: {
      operationId: `list${name}`,
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: `Tenant-scoped ${name.toLowerCase()} list` },
        '401': authenticatedResponses()['401'],
      },
    },
  });

  return Object.freeze({
    ...stage17,
    info: {
      ...info,
      version: '18.0.0',
      description:
        'Authenticated, tenant-scoped CMV trip planning API. Stage 18 accepts entered facts and keeps provider-derived and legal-engine objects server-authoritative.',
    },
    paths: {
      ...paths,
      '/openapi-stage18.json': {
        get: {
          operationId: 'getStage18OpenApiDocument',
          responses: {
            '200': {
              description: 'Stage 18 OpenAPI 3.1 document',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
      '/api/drivers': {
        ...objectValue(paths['/api/drivers'], 'Stage 17 driver path'),
        ...listOperation('Drivers'),
      },
      '/api/drivers/{driverId}': profilePath(
        'DriverProfile',
        'driverId',
        'CreateDriverRequest',
      ),
      '/api/equipment/tractors': {
        ...objectValue(paths['/api/equipment/tractors'], 'Stage 17 tractor path'),
        ...listOperation('Tractors'),
      },
      '/api/equipment/tractors/{tractorId}': profilePath(
        'TractorProfile',
        'tractorId',
        'TractorProfile',
      ),
      '/api/equipment/trailers': {
        ...objectValue(paths['/api/equipment/trailers'], 'Stage 17 trailer path'),
        ...listOperation('Trailers'),
      },
      '/api/equipment/trailers/{trailerId}': profilePath(
        'TrailerProfile',
        'trailerId',
        'TrailerProfile',
      ),
      '/api/equipment/loads': {
        ...objectValue(paths['/api/equipment/loads'], 'Stage 17 load path'),
        ...listOperation('Loads'),
      },
      '/api/equipment/loads/{loadId}': profilePath(
        'LoadProfile',
        'loadId',
        'LoadProfile',
      ),
      '/api/trips/{tripId}/plan': {
        post: {
          operationId: 'planTrip',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            idempotencyHeader(),
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: planTripRequest },
            },
          },
          responses: {
            '201': {
              description:
                'Server-authoritative route, compliance, operational-event, and ETA plan persisted as a new immutable revision',
            },
            ...authenticatedResponses(),
            '422': {
              description: 'Structured legal, verification, or missing-data block',
            },
            '503': {
              description: 'Commercial-routing provider unavailable or blocked',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      ...components,
      schemas,
    },
  });
}
