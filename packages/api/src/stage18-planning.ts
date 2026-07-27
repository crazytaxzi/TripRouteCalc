import type { ApplicationOperationResult } from './application.js';
import type { AuthenticatedPrincipal } from './security.js';
import type { Stage18PlanTripBody } from './stage18-plan-contract.js';

/**
 * Server-authoritative Stage 18 planning boundary.
 *
 * Implementations receive only entered trip facts. They are responsible for
 * assembling provider-derived route data and legal-engine inputs on the server
 * before persisting a new immutable calculated revision.
 */
export interface Stage18PlanningOperation {
  planTrip(
    principal: AuthenticatedPrincipal,
    publicTripId: string,
    body: Stage18PlanTripBody,
    idempotencyKey: string,
  ): Promise<ApplicationOperationResult>;
}
