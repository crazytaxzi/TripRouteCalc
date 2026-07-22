# Stage 18 Recovery Checkpoint: runner and implementation blockers

- Updated: 2026-07-21
- Stage: 18 - Mobile-First Trip Setup and Stop Editor
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Current implementation head before this checkpoint commit: `0dc9e7f69b24c4f0772b7407fd53645eaf84fff1`
- Base branch and commit: `main` at `94a890d6761c21489b1b48d9e4376657b8cd1687`
- Stage status: BLOCKED; not complete and not eligible to merge

## Active external failure

GitHub Actions still rejects the permanent `CI` workflow before any job step starts.

Latest evidence:

- CI run `29882448754`, job `88806001276`, completed with failure against `0dc9e7f69b24c4f0772b7407fd53645eaf84fff1`.
- The job exposes no step summaries and no log URL.
- Earlier permanent and temporary workflow runs failed with the same approximately three-second, empty-step signature.
- A bounded rerun of the temporary preflight workflow also failed before setup.
- Earlier job-log download attempts returned `404 BlobNotFound` and produced no artifacts.
- GitHub notification email showed one job annotation but did not include the annotation text in the email body.

Classification:

- Category: external permission, account-policy, billing/quota, or hosted-runner resource constraint
- Confidence: medium
- Reason: multiple different workflows and one explicit rerun fail before checkout or any repository command executes.
- Exact GitHub annotation: unavailable through the connected GitHub API and notification email body. It must be opened in the GitHub Actions web UI before selecting the precise account remedy.

## Recovery actions completed

1. Preserved PR `#33`, kept it draft, and did not merge or weaken any gate.
2. Reopened and applied `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md` before each continuation.
3. Reconciled the branch, Stage 18 specification, shared guardrails, Stage 17 API contracts, concurrent helper work, and every changed web/API boundary used by the UI.
4. Corrected and then removed the temporary self-mutating preflight workflow after confirming the hosted runner still did not start.
5. Applied the bounded preflight corrections directly:
   - exact optional reusable-profile IDs;
   - required rule-set initialization and validation;
   - explicit Playwright `Page` typing;
   - guarded model-test endpoint access;
   - unused destructuring removal and optional confidence emission.
6. Corrected the Stage 18 client transaction against the real Stage 17 API contract:
   - handled nested `{ trip, stop }` create-stop responses;
   - used public stop field `id` rather than the nonexistent `stopId` assumption;
   - persisted stops incrementally without comparing a partial server prefix to the full draft;
   - resumed immutable trip revisions through the saved public `tripId`;
   - patched equipment and rule-set changes on the existing trip;
   - synchronized stop create, patch, delete, and reorder operations with expected revisions;
   - preserved structured HTTP 422 route and calculation results instead of throwing away blocked evidence;
   - avoided duplicate trip creation during normal recalculation.
7. Expanded the stop editor to cover add, remove, duplicate, insert, drag and button reorder, required or optional state, position locks, all supported appointment modes, all supported service-duration modes, facility hours, parking, duty status, notes, and instructions.
8. Added controlled recalculation behavior with explicit calculation, a 1.2-second valid-change debounce, abortable superseded requests, no invalid automatic requests, and independent local autosave state.
9. Upgraded local recovery to version 2 with validated migration from version 1, structural endpoint enforcement, saved public trip and stop references, and continued exclusion of bearer tokens.
10. Expanded static test coverage for migration, storage isolation, trip-reference recovery, stop operations, appointment and service mapping, focus management, real API envelopes, immutable revisions, one persistent trip chain, structured blocked calculations, responsive workflow, and the version 2 storage key.
11. Closed a provider-failure recovery window:
    - the fully synchronized local draft is now saved immediately after trip and stop persistence and before commercial routing is requested;
    - a regression test forces a route-provider `503` and verifies that the saved trip ID, driver ID, and stop IDs remain recoverable while calculation is never called.
12. Preserved all prior Stage 17 behavior and did not add map or detailed timeline work from Source 19.

## Confirmed implementation gaps from adversarial specification review

These are Stage 18 requirements, not optional future polish:

1. Departure HOS input is still incomplete:
   - expected hours returning through cycle recaps are not entered;
   - existing qualifying sleeper-berth periods are not entered;
   - the current Stage 18 builder hardcodes both collections as empty.
2. Tractor profile input still omits domain-supported facts including VIN, wheelbase, California compliance state/evidence, and notes.
3. Trailer profile input still omits current rail position, rail-position mappings, liftgate, special equipment, and notes.
4. Load input still omits front and rear overhang, temperature requirements, permit restrictions, escort requirements, route restrictions, secure-parking or high-value requirement, and notes.
5. Intermediate lock semantics need hardening: inserting, deleting, duplicating, or moving another stop can currently shift a locked intermediate position even when the locked stop itself is not directly moved.
6. A successful trip calculation can still be visually overwritten as failed when the secondary profile-list refresh fails afterward. The calculation result must remain authoritative while the refresh error is shown separately.

The Stage 18 exit gate cannot be claimed while these gaps remain.

## Remaining mandatory work

1. Implement the confirmed Stage 18 input and lock-semantics gaps above using the existing domain contracts. Do not invent Source 19 behavior or rewrite HOS arithmetic from the UI layer.
2. Isolate post-calculation profile refresh failures from the successful calculation outcome and add regression coverage.
3. Refresh `pnpm-lock.yaml` with pnpm `9.15.4` so the `packages/web` importer and exact dependency graph are represented.
4. Run the complete current Stage 18 head through an authorized environment with Node.js 22, pnpm, PostgreSQL, and Playwright Chromium.
5. Repair evidence-backed failures without weakening validation or deleting prior-stage coverage.
6. Perform final adversarial review against actual test output and the complete PR diff.
7. Update the implementation ledger and write the Stage 18 completion handoff only after every mandatory check passes.
8. Keep PR `#33` draft and do not advance to Source 19 until the Stage 18 exit gate is verified.

## Validation state

Not run successfully for the current Stage 18 implementation:

- `pnpm install --frozen-lockfile`
- Prisma generation
- Prisma schema validation
- clean PostgreSQL migration deployment
- ESLint
- TypeScript type checking
- complete Vitest suite
- production build
- Playwright Chromium installation
- mobile and desktop Playwright workflow
- prior-stage regression gate

No item above may be reported as passed until a runner or equivalent authorized local environment actually executes it.

## Exact continuation sequence

1. Continue implementing the confirmed independent Stage 18 source gaps while preserving the draft PR.
2. Open GitHub Actions run `29882448754` and read the single annotation attached to job `88806001276`.
3. Resolve the annotation-directed account or repository restriction. Inspect personal account Billing and licensing, Actions usage, Actions budgets that stop usage at the limit, payment status, or repository Actions policy only as directed by that annotation.
4. After hosted jobs can start, use one bounded lock-refresh commit or an authorized local checkout to run `pnpm install --no-frozen-lockfile` with pnpm `9.15.4` and commit the resulting lockfile plus only evidence-backed repairs.
5. Run the permanent CI gate and Playwright suite against the resulting head.
6. Continue under `ERROR_RECOVERY_PROTOCOL.md` until all mandatory gates pass, then complete the Stage 18 ledger, handoff, review, and merge sequence.

## Last known-good state

- `main` remains Stage 17 complete, verified, merged, and ledger-closed.
- PR `#33` remains draft and mergeable but unverified.
- Helper PR `#37` is stale, based on an older Stage 18 head, and did not overcome the same pre-step runner failure.
- No production deployment, production database mutation, credential change, or user-data change occurred.
