# Stage 18 Adversarial Review Findings

## Status

Stage 18 remains **IN PROGRESS**. The current mobile trip-setup branch is buildable and its implemented transport behavior is verified, but the Stage 18 exit gate is not yet satisfied.

## Verified implementation

- Mobile-first trip setup shell and responsive controls.
- Independent drive, shift, and cycle inputs.
- Accessible stop insertion, removal, duplication, drag reordering, and button reordering.
- Independent appointment and service settings per stop.
- Local draft persistence and controlled recalculation requests.
- Driver creation, trip creation, immutable revision tracking, equipment-ID patching, and stop persistence through the accepted Stage 17 API.
- Correct singular calculation endpoint: `POST /api/trips/:tripId/calculate`.
- Structured API error-envelope handling.
- Focused transport tests for endpoint selection, driver/trip creation, revision chaining, and stop serialization.

## Blocking gaps found by adversarial review

The current UI cannot yet submit a complete validated real-world calculation without information or orchestration outside the interface.

1. The driver form exposes only three remaining-clock values and omits required HOS departure facts such as cycle type, interruption history, prior duty days, recaps, sleeper eligibility and periods, restart planning, carrier limits, and rest preferences.
2. Tractor, trailer, and load controls currently accept opaque public identifiers but do not provide the full reusable profile creation and editing workflows required by the Stage 18 source.
3. Stops accept address text but do not capture or obtain provider-resolved or user-confirmed coordinates required by the commercial-routing contract.
4. The calculation payload is not a complete `EtaSimulationInput`. It lacks a validated commercial route, full initial HOS context, speed model, segment conditions, operational events, compliance actions, fuel plan, and other accepted simulator inputs.
5. The UI does not yet call `/api/routes/validate` with the complete commercial route request assembled from resolved stops and physical equipment facts.
6. B-002 remains open, so a production commercial-routing provider may return an explicit provider-setup failure. Stage 18 must handle that honestly but must not invent a consumer-routing fallback.
7. Existing saved stop edits, deletions, and reorders are not yet synchronized through the corresponding immutable Stage 17 revision endpoints after the initial save.

## Architecture decision

Decision `D18-001` in `docs/implementation/decisions/18-trip-planning-orchestration.md` requires the browser to submit entered facts and the server to assemble the normalized commercial route, HOS, compliance, operational-event, and ETA inputs through accepted packages.

The browser must not fabricate legal or provider-derived objects merely to satisfy the low-level Stage 17 calculation contract.

## Continuation handoff

The exact remaining implementation sequence and closure checklist are recorded in:

`docs/implementation/handoffs/18-mobile-trip-setup.md`

## Decision

Do not merge, ledger-close, or advance to Stage 19 merely because the repository gate passes. Continue Stage 18 until a user can enter all mandatory facts, persist and revise the complete setup, request server-authoritative commercial planning, and submit the accepted calculation workflow without editing raw JSON.

The map, results visualization, detailed timeline display, and result-oriented clock cards remain Stage 19 scope. Stage 18 must produce the immutable calculated revision consumed by Stage 19, but it must not implement Stage 19 presentation behavior.

## Verification evidence

Permanent CI run `1544` (`29947818779`) passed on the verified partial implementation and adversarial-review documentation, including frozen install, Prisma generation and validation, clean PostgreSQL migration deployment, lint, type-check, full tests, and production build. This evidence verifies the implemented subset only; it does not override the blocking requirement gaps above.
