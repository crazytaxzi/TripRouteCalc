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

## Endpoint groups

- Trip setup: create, retrieve, patch, and read immutable revisions.
- Stop setup: add, patch, delete, and concurrency-safe reorder using stable logical stop identities.
- Calculation results: calculate, retrieve the current timeline, and retrieve compliance evidence.
- Reference data: create drivers, tractors, trailers, and loads through the accepted domain validators.
- External evidence: validate a commercial route through the configured provider runtime and retrieve the active regulatory version.

Write routes require one `idempotency-key` header. A completed equivalent retry replays the original status and body. A reused key with different request content returns `409 IDEMPOTENCY_CONFLICT`. A stale expected revision returns `409 REVISION_CONFLICT` with the current revision reference.

The in-memory fixed-window limiter is suitable for tests and a single process. A distributed store remains deployment-stage work.
