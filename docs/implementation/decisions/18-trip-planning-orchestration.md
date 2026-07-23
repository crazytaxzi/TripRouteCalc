# Stage 18 Trip-Planning Orchestration Decision

## D18-001: The browser submits facts; the server assembles legal planning inputs

**Status:** Accepted for Stage 18 completion

The Stage 18 mobile workflow must not fabricate commercial routes, HOS evidence, operational events, compliance actions, speed assumptions, or ETA simulation objects in browser code. Those objects contain legal and provider-derived meaning and remain server-authoritative under the Prime Directive and the accepted Stage 17 boundaries.

The current Stage 17 API exposes low-level route validation and calculation operations, but it requires callers to submit a complete normalized route and ETA simulation payload. That contract is appropriate for trusted integrations and deterministic acceptance tests. It is not sufficient for the Stage 18 human trip-setup workflow because the user enters operational facts, not normalized legal-engine JSON.

Stage 18 therefore adds one server-side orchestration operation that accepts a validated trip-planning request built from UI facts and performs the following sequence:

1. authenticate and resolve the tenant-scoped trip revision;
2. validate the complete driver HOS departure state and preserve its provenance;
3. validate or create reusable tractor, trailer, and load profiles;
4. resolve or reject every stop location without silently inventing coordinates;
5. derive route-ready equipment only through accepted equipment validators;
6. request and validate a commercial route through the accepted routing runtime;
7. construct operational events, compliance actions, and ETA inputs through accepted domain services;
8. run the accepted ETA simulator;
9. persist an immutable calculated revision with warnings, evidence, confidence, explanations, and audit metadata;
10. return structured success, legal-blocking, missing-data, provider-unavailable, and stale-revision responses.

## Required API shape

The implementation may refine names during coding, but the public behavior must remain equivalent to:

`POST /api/trips/:tripId/plan`

The request contains:

- `expectedRevisionNumber`
- complete driver departure and HOS facts
- selected or newly created equipment/load profile facts
- ordered stop facts, appointment details, service details, duty statuses, and resolved-location evidence
- explicit planning assumptions and user choices

The request must not contain a caller-authored normalized route, legal result, compliance result, confidence result, or ETA timeline.

The response contains:

- the new immutable trip revision
- calculation status
- structured warnings and blocking findings
- route and timeline references needed by Stage 19
- no database identifiers or provider credentials

## D18-002: No silent route or legal defaults

**Status:** Accepted

The orchestration layer may use configurable non-legal presentation defaults only when they are visibly disclosed and editable. It must reject or explicitly block when critical HOS, axle, weight, dimension, hazmat, permit, stop-resolution, time-zone, or provider facts are missing. It must not substitute nominal equipment dimensions, guessed coordinates, assumed duty status, or fabricated route geometry.

## D18-003: Stage 19 consumes the calculated revision

**Status:** Accepted

Stage 19 map and timeline work consumes the immutable route and ETA revision produced by the Stage 18 orchestration endpoint. Stage 18 may display submission status and structured warnings, but it must not pre-build Stage 19 map or timeline presentation behavior.

## Completion consequence

Stage 18 cannot be marked complete until the UI can submit a complete real-world plan through this server boundary without raw JSON and the repository has passing workflow tests for success, missing critical data, stale revision, provider unavailability, and legal blocking. A green build of the partial browser package alone does not satisfy the exit gate.
