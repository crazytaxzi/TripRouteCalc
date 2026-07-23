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
  - local trip setup state;
  - accessible stop add, insert, duplicate, remove, and reorder operations;
  - local validation and draft serialization.
- `packages/web/src/app.ts`
  - mobile-first form shell;
  - driver/departure, equipment references, stops, appointments, service, warnings, focus management, and controlled recalculation UI;
  - local draft persistence.
- `packages/web/src/api-client.ts`
  - structured authenticated requests;
  - driver and trip creation;
  - equipment-reference patching;
  - sequential stop creation with immutable revision tracking;
  - correct singular `/calculate` transport.
- `packages/web/test/model.test.ts`
  - stop-editor state behavior.
- `packages/web/test/api-client.test.ts`
  - accepted calculation endpoint;
  - driver/trip/stop creation and revision chaining;
  - stop payload serialization.
- `packages/web/index.html`, `packages/web/styles.css`, `packages/web/tsconfig.json`, and root TypeScript reference integration.

## Adversarial defects already corrected

- Replaced the invalid `/calculations` URL with `/calculate`.
- Added actual driver creation, trip creation, stop persistence, and revision chaining instead of requiring a preexisting trip identifier.
- Added structured Stage 17 API error-envelope handling.
- Removed all temporary diagnostic workflows after extracting exact lint and compiler evidence.

## Required remaining implementation

### 1. Server planning orchestration

Implement decision `D18-001` as a server-authoritative operation equivalent to:

`POST /api/trips/:tripId/plan`

The browser submits entered facts. The server must validate and assemble route, HOS, compliance, operational-event, and ETA inputs through accepted packages. Do not move legal or provider-derived construction into the browser.

Required workflow tests:

- complete successful plan through a deterministic provider;
- missing critical HOS/equipment/location data;
- stale expected revision;
- routing provider blocked/unavailable;
- legal or verification block with structured findings;
- tenant isolation and opaque identifiers;
- idempotent retry behavior.

### 2. Complete HOS departure form

Add every field required by Source 18, including:

- cycle type;
- driven since the last qualifying interruption;
- current-shift on-duty time;
- immediately preceding off-duty time;
- qualifying ten-hour-break completion;
- seven/eight-day prior-duty totals;
- recap returns;
- sleeper eligibility and existing sleeper periods;
- split-sleeper choice;
- planned 34-hour restart;
- carrier driving and duty targets;
- optional rest preference;
- provenance for user-entered or imported facts.

The three primary clocks remain independent.

### 3. Complete reusable equipment and load forms

Implement select/create/edit flows matching accepted equipment schemas and Source 18. Critical route measurements and axle weights must be explicit. Missing critical facts must block or reduce confidence through server validation, never nominal browser defaults.

### 4. Stop resolution and complete stop facts

Add:

- provider-resolved or user-confirmed coordinates;
- resolution source/evidence;
- all appointment modes;
- facility hours;
- separate waiting, check-in, and service duty statuses;
- check-in duration;
- instructions distinct from notes.

### 5. Persisted stop synchronization

For stops with server identifiers, support immutable-revision:

- patch;
- delete;
- reorder;
- stale-conflict recovery;
- local draft preservation after failure.

Do not recreate every persisted stop as a new stop.

### 6. Stage 18 exit-gate acceptance

Add a browser workflow acceptance test proving a user can enter a complete real-world plan and submit it without editing raw JSON. Test mobile and desktop layout behavior, keyboard reorder, focus management, non-color severity cues, reduced motion, and provider/calculation errors.

## Verification evidence to date

Permanent CI run `1544` (`29947818779`) passed frozen install, Prisma generation and validation, clean PostgreSQL migration deployment, lint, type-check, complete tests, and build for the verified partial implementation and adversarial-review documentation.

That run is repository-health evidence only. It is not Stage 18 exit-gate evidence.

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
