# TripRouteCalc REST API

Stage 17 exposes the accepted domain, routing, compliance, ETA, confidence, and persistence services through one Fastify 5 package.

## Boundary rules

- Every `/api` route requires an authenticated carrier and actor context.
- Authentication does not replace tenant membership and object-ownership checks in persistence.
- Public resource identifiers use typed deterministic authenticated encryption and never expose database UUIDs.
- Write contracts reject unknown fields and ambiguous bare measurements.
- Trip and stop mutations create immutable revisions and require an expected revision number.
- Idempotent write retries reuse the original response only when the operation, key, and request hash match.
- Legal or manual-verification blocks are structured `422` outcomes, not hidden warnings in an otherwise successful payload.
- Provider outages and missing provider setup are `503` service-availability outcomes.
- Controllers do not perform HOS, compliance, stop, route, ETA, confidence, or explanation arithmetic.
- `/openapi.json` is the authoritative machine-readable Stage 17 contract.

The in-memory fixed-window limiter is suitable for tests and a single process. A distributed store remains deployment-stage work.
