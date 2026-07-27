import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type {
  AuthenticatedPrincipal,
  BearerAuthenticator,
  RateLimiter,
  Stage18PlanningOperation,
} from '../src/index.js';
import { registerStage18PlanningRoutes } from '../src/index.js';

function validPlanningBody(): Record<string, unknown> {
  return {
    expectedRevisionNumber: 12,
    departureAt: '2026-07-23T08:00:00-06:00',
    departureTimeZone: 'America/Boise',
    currentDutyStatus: 'on_duty_not_driving',
    currentDutyStatusBeganAt: '2026-07-23T07:30:00-06:00',
    clocks: {
      driveMinutesRemaining: 600,
      shiftMinutesRemaining: 780,
      cycleMinutesRemaining: 3_600,
    },
    hos: {
      cycleType: '70_in_8',
      provenance: 'user_entered',
      drivenSinceQualifyingInterruptionMinutes: 0,
      onDutyCurrentShiftMinutes: 30,
      offDutyBeforeDepartureMinutes: 600,
      qualifyingTenHourBreakCompleted: true,
      priorDutyTotals: [{ date: '2026-07-22', onDutyMinutes: 480 }],
      cycleRecaps: [],
      sleeperBerthEligible: true,
      existingSleeperPeriods: [],
      splitSleeperEnabled: false,
      plannedThirtyFourHourRestart: false,
      carrierMaximumDrivingMinutes: 660,
      carrierMaximumDutyMinutes: 840,
      restPreference: {
        enabled: false,
        startLocalTime: '',
        endLocalTime: '',
      },
    },
    routePolicy: 'balanced-compliant',
    avoidances: ['ferries', 'unpaved-roads'],
  };
}

const authenticatedPrincipal: AuthenticatedPrincipal = Object.freeze({
  carrierId: '11111111-1111-4111-8111-111111111111',
  actorUserId: '22222222-2222-4222-8222-222222222222',
  tokenId: 'stage-18-route-test-token',
  issuedAt: 1,
  expiresAt: 9_999_999_999,
});

function authenticator(): BearerAuthenticator {
  return {
    authenticate: (authorizationHeader): AuthenticatedPrincipal => {
      expect(authorizationHeader).toBe('Bearer route-test-token');
      return authenticatedPrincipal;
    },
  };
}

function rateLimiter(): RateLimiter {
  return {
    consume: (principalKey): ReturnType<RateLimiter['consume']> => {
      expect(principalKey).toBe(
        `${authenticatedPrincipal.carrierId}:${authenticatedPrincipal.actorUserId}:${authenticatedPrincipal.tokenId}`,
      );
      return {
        allowed: true,
        limit: 100,
        remaining: 99,
        resetAtEpochSeconds: 2_000_000_000,
      };
    },
  };
}

describe('Stage 18 planning HTTP boundary', () => {
  it('authenticates, validates entered facts, and delegates explicit route choices without browser-authored legal objects', async () => {
    const planTrip = vi.fn<Stage18PlanningOperation['planTrip']>(
      (_principal, tripId, body, key) => {
        expect(tripId).toBe('trip-public-identifier');
        expect(body.expectedRevisionNumber).toBe(12);
        expect(body.hos.cycleType).toBe('70_in_8');
        expect(body.routePolicy).toBe('balanced-compliant');
        expect(body.avoidances).toEqual(['ferries', 'unpaved-roads']);
        expect(key).toBe('stage-18-plan-key');
        expect('route' in body).toBe(false);
        expect('simulation' in body).toBe(false);
        return Promise.resolve({
          statusCode: 201,
          body: {
            trip: { currentRevision: { revisionNumber: 13 } },
            calculationStatus: 'AVAILABLE',
          },
        });
      },
    );
    const app = registerStage18PlanningRoutes(Fastify(), {
      planning: { planTrip },
      authenticator: authenticator(),
      rateLimiter: rateLimiter(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips/trip-public-identifier/plan',
      headers: {
        authorization: 'Bearer route-test-token',
        'idempotency-key': 'stage-18-plan-key',
      },
      payload: validPlanningBody(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['x-ratelimit-limit']).toBe('100');
    expect(response.headers['x-ratelimit-remaining']).toBe('99');
    expect(planTrip).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('rejects missing route choices before planning delegation', async () => {
    const planTrip = vi.fn<Stage18PlanningOperation['planTrip']>();
    const app = registerStage18PlanningRoutes(Fastify(), {
      planning: { planTrip },
      authenticator: authenticator(),
      rateLimiter: rateLimiter(),
    });
    const body = validPlanningBody();
    delete body.routePolicy;

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips/trip-public-identifier/plan',
      headers: {
        authorization: 'Bearer route-test-token',
        'idempotency-key': 'stage-18-plan-key',
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(planTrip).not.toHaveBeenCalled();
    await app.close();
  });

  it('publishes the Stage 18 plan and reusable profile endpoints separately from the accepted Stage 17 document', async () => {
    const app = registerStage18PlanningRoutes(Fastify(), {
      planning: {
        planTrip: (): Promise<never> =>
          Promise.reject(new Error('The planning operation should not run.')),
      },
      authenticator: authenticator(),
      rateLimiter: rateLimiter(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/openapi-stage18.json',
    });
    const document = response.json<{
      readonly info?: { readonly version?: string };
      readonly paths?: Readonly<Record<string, unknown>>;
    }>();

    expect(response.statusCode).toBe(200);
    expect(document.info?.version).toBe('18.0.0');
    expect(document.paths).toHaveProperty('/api/trips/{tripId}/plan');
    expect(document.paths).toHaveProperty('/api/equipment/tractors/{tractorId}');
    await app.close();
  });
});
