# Stage 17 Architectural Decisions

## D17-001: Add one Fastify API package

**Status:** Accepted

The repository has no existing HTTP framework. Stage 01 names Fastify or an equally lightweight TypeScript backend as the greenfield default. Stage 17 adds one `@trip-route-calc/api` package using Fastify 5 on the existing Node.js 22 baseline. It does not add a parallel business layer or duplicate domain calculations.

## D17-002: Controllers delegate to application and persistence services

**Status:** Accepted

Route handlers authenticate, parse Zod contracts, map opaque identifiers, invoke application services, and serialize public responses. HOS, route, regulatory, stop, ETA, confidence, and explanation arithmetic remain in the accepted foundation, routing, compliance, and persistence packages.

## D17-003: Do not expose database identifiers

**Status:** Accepted

Public identifiers are typed opaque tokens signed with HMAC-SHA256. The token carries an entity type and internal UUID but does not reveal the UUID. Type prefixes prevent using a stop identifier as a trip, driver, equipment, revision, or rule-set identifier. Tampering or cross-type use is rejected before repository access.

## D17-004: Require authenticated tenant context

**Status:** Accepted

Every `/api` endpoint requires a bearer token verified through an injected authenticator. The accepted HMAC authenticator validates signature, expiry, carrier, actor user, and token identifier. Persistence repositories still verify tenant membership and ownership. Authentication never replaces repository authorization.

## D17-005: Use immutable revisions for trip and stop writes

**Status:** Accepted

Trip setup, stop add, patch, delete, reorder, and calculation produce immutable trip revisions. Write requests carry an expected revision number. The persistence layer checks that value inside the write transaction and returns a conflict rather than silently overwriting a newer revision.

## D17-006: Persist idempotency for retried writes

**Status:** Accepted

Idempotency keys are stored per carrier, operation, and key with a request hash and response snapshot. Reusing a key with the same request returns the prior response. Reusing it with a different request returns a conflict. This applies to trip creation, stop writes, reorder, and calculation.

## D17-007: Validate every boundary with Zod

**Status:** Accepted

Headers, path parameters, query strings, request bodies, public identifiers, authentication claims, and application inputs are validated. Unknown fields are rejected on write contracts. Domain constructors and repositories perform their existing validation again at the next boundary.

## D17-008: Keep legal blocking distinct from transport failure

**Status:** Accepted

Invalid requests return `400`, unauthenticated requests return `401`, forbidden or cross-account requests return `403` or tenant-safe `404`, conflicts return `409`, provider unavailability returns `503`, and legal or verification blocks return `422` with structured findings, references, required actions, confidence, and explanations. Legal blocking is not converted into a generic server error.

## D17-009: Publish one generated contract document

**Status:** Accepted

The API owns a deterministic OpenAPI 3.1 document generated from the registered route contracts and examples. `/openapi.json` is public. Interactive UI dependencies are deferred; the machine-readable document is authoritative for Stage 17.

## D17-010: Rate limiting is an injected boundary

**Status:** Accepted

The API applies a configurable per-principal fixed-window limiter before route execution. The default memory store is suitable for one process and tests. A distributed store remains deployment work; the limiter interface prevents controllers from depending on storage details.
