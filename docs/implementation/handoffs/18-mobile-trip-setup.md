# Stage 18 Mobile Trip Setup Handoff

## Status

Stage 18 is active on branch `agent/stage-18-mobile-trip-setup` in draft pull request `#39`.

The implemented subset is repository-green but the Stage 18 exit gate is not yet satisfied. Do not merge the PR, close the ledger, or begin Stage 19 until the remaining work below is implemented and verified.

## Read first

1. `/PRIME_DIRECTIVE.md`
2. `/ERROR_RECOVERY_PROTOCOL.md`
3. `docs/specification/00_READ_ME_FIRST.md`
4. `docs/implementation/STATUS.md`
5. `docs/specification/18_MOBILE_TRIP_SETUP_UI.md`
6. `docs/implementation/decisions/18-mobile-trip-setup-adversarial-review.md`
7. `docs/implementation/decisions/18-trip-planning-orchestration.md`
8. `docs/implementation/handoffs/17-rest-api-validation.md`

## Verified implementation already present

- `packages/web/src/model.ts`
  - independent drive, shift, and cycle clocks;
  - complete Stage 18 HOS departure-state model;
  - cycle type and HOS-fact provenance;
  - interruption, current-shift duty, immediately preceding off-duty, and qualifying-break facts;
  - prior daily duty totals and cycle recap returns;
  - sleeper eligibility, existing sleeper periods, split-sleeper choice, and planned restart;
  - carrier driving/duty targets and optional nightly rest preference;
  - adversarial validation for inconsistent sleeper, carrier-target, prior-history, recap, and rest-preference inputs;
  - local trip setup state;
  - accessible stop add, insert, duplicate, remove, and reorder operations;
  - persisted-stop deletion tracking;
  - backward-compatible local draft restoration, including drafts created before the HOS model existed.
- `packages/web/src/hos-row-operations.ts`
  - immutable add, update, and remove operations for prior-duty totals;
  - cycle-aware six-day or seven-day prior-duty row limits;
  - immutable add, update, and remove operations for cycle recaps;
  - immutable add, update, and remove operations for sleeper periods;
  - invalid row indexes return the original state without mutation.
- `packages/web/src/hos-row-editor.ts`
  - accessible add/remove row rendering for prior-duty totals, cycle recaps, and sleeper periods;
  - explicit empty states and non-color-only labels;
  - HTML escaping for entered values;
  - cycle-aware prior-duty add limits.
- `packages/web/src/hos-row-enhancement.ts`
  - installs the accessible row editor into the existing app without replacing private application state;
  - preserves the legacy textarea draft format as the compatibility boundary;
  - mirrors row edits through the existing app input path across synchronous rerenders;
  - safely narrows cycle and row-kind DOM values without unchecked assertions.
- `packages/web/src/app.ts`
  - mobile-first driver, departure, and complete visible HOS form;
  - explicit cycle and provenance controls;
  - interruption, current-shift duty, preceding off-duty, carrier-limit, break, sleeper, restart, and rest-preference controls;
  - equipment references, stops, appointments, service, warnings, focus management, and controlled recalculation UI;
  - local draft persistence across render, save, calculation, and request failures.
- `packages/web/src/index.ts`
  - installs the HOS repeating-row enhancement after the application shell initializes.
- `packages/web/src/api-client.ts`
  - structured authenticated requests;
  - driver and trip creation;
  - equipment-reference patching;
  - sequential stop creation with immutable revision tracking;
  - persisted stop patch, delete, and reorder synchronization;
  - correct singular `/calculate` transport;
  - complete entered HOS facts included in the current browser payload without browser-side legal arithmetic.
- `packages/api/src/contracts.ts`
  - strict `PlanTripBodySchema` for entered planning facts;
  - offset-aware departure and duty-status timestamps;
  - explicit rejection of browser-authored route, simulation, operational-event, and compliance objects.
- `packages/web/test/model.test.ts`
  - stop-editor state behavior;
  - independent clocks;
  - complete HOS-history validation;
  - invalid sleeper and carrier constraints;
  - legacy-draft recovery.
- `packages/web/test/hos-row-operations.test.ts`
  - immutable row operations;
  - selected-cycle row limits;
  - invalid-index behavior.
- `packages/web/test/hos-row-editor.test.ts`
  - accessible rendering, empty states, cycle limits, and HTML escaping.
- `packages/web/test/hos-row-enhancement.test.ts`
  - compatibility-format parsing and serialization;
  - immutable add/remove transforms;
  - selected-cycle limits and invalid-index behavior.
- `packages/web/test/api-client.test.ts`
  - accepted calculation endpoint;
  - driver/trip/stop creation and revision chaining;
  - persisted delete, patch, and reorder revision chaining;
  - complete-HOS calculation fixture;
  - stop payload serialization.
- `packages/api/test/plan-trip-contract.test.ts`
  - valid entered-fact request acceptance;
  - contradictory sleeper and carrier-limit rejection;
  - offset-less timestamp rejection;
  - rejection of server-owned legal-engine objects.
- `packages/web/index.html`, `packages/web/styles.css`, `packages/web/tsconfig.json`, and root TypeScript reference integration.

## Adversarial defects already corrected

- Replaced the invalid `/calculations` URL with `/calculate`.
- Added actual driver creation, trip creation, stop persistence, and revision chaining instead of requiring a preexisting trip identifier.
- Added structured Stage 17 API error-envelope handling.
- Added immutable persisted-stop patch, delete, and reorder synchronization without discarding the local draft on failure.
- Added explicit HOS cycle/provenance validation and rejected contradictory split-sleeper and carrier-limit inputs.
- Preserved older browser drafts by filling newly introduced HOS fields from the current schema defaults.
- Exposed every required Stage 18 HOS departure fact in the mobile form rather than leaving the complete model inaccessible.
- Added pure repeating-row operations so malformed indexes and cycle-limit overflow cannot corrupt HOS draft state.
- Replaced line-only HOS entry with accessible add/remove row controls while preserving the accepted draft serialization boundary.
- Replayed textarea updates against each newly rendered form so synchronous application rerenders cannot drop recap or sleeper changes.
- Removed all temporary diagnostic workflows and restored the permanent CI workflow after extracting exact lint evidence.

## Required remaining implementation

### 1. Server planning orchestration

Implement decision `D18-001` as a server-authoritative operation equivalent to:

`POST /api/trips/:tripId/plan`

The strict request contract now exists. The remaining work is to expose the HTTP route and implement the application-service orchestration that validates and assembles route, HOS, compliance, operational-event, and ETA inputs through accepted packages. Do not move legal or provider-derived construction into the browser.

Required workflow tests:

- complete successful plan through a deterministic provider;
- missing critical HOS/equipment/location data;
- stale expected revision;
- routing provider blocked/unavailable;
- legal or verification block with structured findings;
- tenant isolation and opaque identifiers;
- idempotent retry behavior.

### 2. Complete reusable equipment and load forms

Implement select/create/edit flows matching accepted equipment schemas and Source 18. Critical route measurements and axle weights must be explicit. Missing critical facts must block or reduce confidence through server validation, never nominal browser defaults.

### 3. Stop resolution and complete stop facts

Add:

- provider-resolved or user-confirmed coordinates;
- resolution source/evidence;
- all appointment modes;
- facility hours;
- separate waiting, check-in, and service duty statuses;
- check-in duration;
- instructions distinct from notes.

### 4. Stage 18 exit-gate acceptance

Add a browser workflow acceptance test proving a user can enter a complete real-world plan and submit it without editing raw JSON. Test mobile and desktop layout behavior, keyboard reorder, focus management, non-color severity cues, reduced motion, and provider/calculation errors.

## Verification evidence to date

Permanent CI run `1624` (`30107366947`) passed frozen install, Prisma generation and validation, clean PostgreSQL migration deployment, lint, type-check, complete tests, and build on commit `6d2668b7129ea7763751f3acd32188ec58b11b5c`.

This verifies the accessible HOS repeating-row integration, its compatibility transforms, the strict `/plan` request contract, complete visible HOS form, HOS state/validation, persisted-stop synchronization, and all prior implemented work. It is not Stage 18 exit-gate evidence because the `/plan` HTTP/application orchestration, reusable equipment/load forms, stop resolution, and final workflow acceptance remain incomplete.

## Closure checklist

Before Stage 18 may close:

- all required work above is implemented;
- no temporary workflows or artifacts are committed;
- adversarial review has no unresolved blocking findings;
- permanent CI passes on the final implementation head;
- permanent CI passes on the final handoff and ledger head;
- `docs/implementation/STATUS.md` marks Stage 18 complete and advances the exact next source to `19_MAP_TIMELINE_AND_RESULTS_UI.md`;
- PR `#39` is ready for review and merged;
- a separate ledger-closure change is completed if required by the repository process.

## Exact next source after closure

`docs/specification/19_MAP_TIMELINE_AND_RESULTS_UI.md`

This source remains blocked until the Stage 18 closure checklist is complete.
