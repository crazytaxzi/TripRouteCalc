# Stage 18 Advanced Evidence and Offline Verification Checkpoint

- Updated: 2026-07-22
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Status: Stage 18 source integration complete; dependency-backed release gate unavailable; pull request remains draft and unmerged

## Source integration completed

### HOS evidence

The web workflow now collects, recovers, edits, validates, and maps:

- expected cycle recap returns;
- recap source dates and local availability times;
- returned cycle minutes;
- existing sleeper-period evidence;
- sleeper start and end times, duration, short or long candidate role, pair ID, source, and explanation.

Local values are converted with the departure IANA time zone and passed through the existing central HOS validator. Older drafts receive empty evidence collections; no recap hours or sleeper history are invented.

### Advanced tractor, trailer, and load evidence

The running `App.tsx` now mounts `EquipmentDetailEditor` and uses the composed detailed recovery and validation facade. The workflow includes:

- tractor VIN, wheelbase, California compliance state and evidence, and notes;
- trailer current rail position, exact rail-to-KPRA mappings, liftgate, special equipment, and notes;
- load front and rear overhang, Fahrenheit temperature requirements, exact permit records, jurisdiction and permit restrictions, escort requirements, route restrictions, secure or high-value parking requirements, and notes.

Saved profiles round-trip these facts back into editable form state. The obsolete flat permit-identifier input was removed so it cannot diverge from the authoritative permit rows.

### Persistence and API corrections

The planning client now:

- serializes the detailed tractor, trailer, and load profiles for reusable-profile writes;
- supplies the detailed equipment combination to commercial routing;
- saves synchronized trip and stop continuation references before calling the route provider;
- clears stale public stop IDs that are absent from the current server trip, then recreates those stops instead of wedging the revision chain;
- preserves structured HTTP 422 blockers;
- continues an existing immutable trip revision chain rather than creating duplicate trips during recalculation;
- conditionally emits the abort signal under exact optional property typing.

Detailed local recovery now handles malformed JSON through the core recovery cleanup rather than throwing before the recovery banner can render.

### Accessibility and cleanup

- Locked intermediate positions remain absolute across all structural editing paths.
- The stop-editor live announcement now uses an actual assistive-only CSS utility.
- A wiring regression verifies the assistive stylesheet is loaded by the web entry point.
- The temporary advanced-integration patch script was removed after its changes were applied.

## Regression coverage committed

The branch contains focused coverage for:

- detailed profile serialization and Fahrenheit conversion;
- detailed profile round-trip;
- legacy permit migration;
- malformed detailed evidence;
- malformed JSON recovery cleanup;
- mounted advanced editor autosave;
- absence of the obsolete flat permit field;
- detailed App, API, abort-signal, stale-stop, and assistive-stylesheet wiring;
- HOS recap and sleeper evidence;
- immutable trip revisions, provider failure recovery, structured blockers, profile-refresh isolation, and locked-stop structural edits.

These tests are committed source. They have not been represented as executed by Vitest because the package runtime cannot currently be installed.

## Offline verification actually executed

An exact copy of the rewritten Stage 18 source boundaries was reconstructed locally and checked with the installed TypeScript `5.8.3` compiler.

Executed checks:

1. TypeScript parser checks with TSX enabled for:
   - `packages/web/src/App.tsx`;
   - `packages/web/src/api-client.ts`;
   - `packages/web/src/equipment-detail-model.ts`.
2. TypeScript parser checks for the newly committed regression files:
   - `packages/web/src/equipment-detail-recovery.test.ts`;
   - `packages/web/src/stage18-wiring.test.ts`;
   - `packages/web/src/App.advanced.test.tsx`.
3. A strict clean-room semantic compile using the real Stage 18 form contracts and controlled declarations only for unavailable external package boundaries, with:
   - `strict`;
   - `exactOptionalPropertyTypes`;
   - `noUncheckedIndexedAccess`;
   - `noUnusedLocals`;
   - `noUnusedParameters`;
   - ES2022 and DOM libraries;
   - bundler module resolution.

The first strict pass found and caused repairs for real defects:

- an explicit `signal: undefined` supplied to `fetch` under exact optional typing;
- an unused foundation type import;
- invalid repeated narrowing of an `unknown` legacy permit identifier value.

After those repairs, the strict clean-room semantic compile was rerun on the final source and completed with no diagnostics. All three new regression files also completed their TypeScript parser checks with no diagnostics.

This is genuine source verification, but it is intentionally not described as the repository's full `pnpm typecheck` because unavailable third-party packages were represented at their public boundaries.

## Infrastructure attempts and remaining unavailable gates

GitHub Actions continues to fail before checkout with zero job steps and no log archive. The latest previously inspected run was `29886457427`, job `88817901032`.

The local runtime has Node.js 22 and TypeScript 5.8.3, but no pnpm, React, Zod, Vitest, Vite, ESLint, Prisma, PostgreSQL harness, or Playwright installation. The only reachable package registry endpoint repeatedly returned HTTP `503`, including three bounded retries on 2026-07-22. External npm and GitHub download routes are blocked from the runtime. No useful npm or pnpm cache was present.

Therefore these gates remain unavailable and are not marked passed:

- `pnpm install --frozen-lockfile`;
- pnpm 9.15.4 lockfile refresh for the `packages/web` importer;
- Prisma generation and schema validation;
- clean PostgreSQL migration deployment;
- repository ESLint;
- full dependency-backed TypeScript typecheck;
- complete Vitest suite;
- Vite production build;
- Playwright Chromium installation and mobile or desktop workflows;
- complete prior-stage regression gate.

## Continuation boundary

The independent Stage 18 source work identified by the adversarial specification review is implemented and pushed. No known source-integration item remains intentionally deferred to Source 19.

PR `#33` must remain draft and unmerged until an environment with the repository dependency graph can execute the unavailable gates. When package access is restored, the next authorized checkout must:

1. refresh `pnpm-lock.yaml` with pnpm `9.15.4`;
2. execute the complete root `check` workflow plus clean database migration deployment;
3. repair only evidence-backed failures without weakening validation;
4. complete the Stage 18 implementation ledger, handoff, and final adversarial review;
5. merge only after every mandatory result is actually green.

No unavailable test, build, migration, lint, or browser result is represented as successful in this checkpoint.
