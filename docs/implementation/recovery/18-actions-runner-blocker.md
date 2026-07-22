# Stage 18 Recovery Checkpoint: GitHub Actions runner did not start

- Updated: 2026-07-21
- Stage: 18 - Mobile-First Trip Setup and Stop Editor
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Implementation head before this checkpoint update: `13357f9b2759ecd4d603c658e1ad03aabd693171`
- Base branch and commit: `main` at `94a890d6761c21489b1b48d9e4376657b8cd1687`
- Stage status: BLOCKED; not complete and not eligible to merge

## Active failure

GitHub Actions still rejects the permanent `CI` workflow before any job step starts.

Latest evidence:

- CI run `29880640595`, job `88800533958`, completed with failure against `13357f9b2759ecd4d603c658e1ad03aabd693171`.
- The job exposes no step summaries and no log URL.
- Earlier permanent and temporary workflow runs failed with the same approximately three-second, empty-step signature.
- A bounded rerun of the temporary preflight workflow also failed before setup.
- Earlier job-log download attempts returned `404 BlobNotFound` and produced no artifacts.
- GitHub notification email showed one job annotation but did not include the annotation text in the email body.

## Classification

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
7. Expanded the stop editor to cover the Stage 18 contract:
   - add, remove, duplicate, and insert;
   - drag and button reorder;
   - required or optional;
   - lock position;
   - earliest, latest, fixed, window, and open-window appointments;
   - exact, expected, range, and historical-average service durations;
   - facility hours, parking, duty status, notes, and instructions.
8. Added controlled recalculation behavior:
   - explicit calculation remains available;
   - optional recalculation waits 1.2 seconds after valid changes settle;
   - superseded requests are aborted;
   - invalid drafts never trigger automatic requests;
   - local autosave state is independent from calculation state.
9. Upgraded local recovery to version 2 with validated migration from version 1, structural endpoint enforcement, saved public trip and stop references, and continued exclusion of bearer tokens.
10. Expanded static test coverage for:
    - draft migration and storage isolation;
    - trip-reference recovery;
    - stop duplicate, insert, lock, optional, and endpoint protection;
    - appointment and service-duration mapping;
    - first-invalid-field focus;
    - nested API responses, immutable revisions, one persistent trip chain, and structured blocked calculations;
    - responsive browser interaction and the version 2 storage key.
11. Preserved all prior Stage 17 behavior and did not add map or detailed timeline work from Source 19.

## Remaining mandatory work

1. Refresh `pnpm-lock.yaml` with pnpm `9.15.4` so the `packages/web` importer and its exact dependency graph are represented. The current frozen lockfile is not acceptable as final evidence.
2. Run the complete current Stage 18 head through an authorized environment with Node.js 22, pnpm, PostgreSQL, and Playwright Chromium.
3. Repair any evidence-backed failures without weakening validation or deleting prior-stage coverage.
4. Perform the final adversarial review against actual test output and the complete PR diff.
5. Update the implementation ledger and write the Stage 18 completion handoff only after all mandatory checks pass.
6. Keep PR `#33` draft and do not advance to Source 19 until the Stage 18 exit gate is verified.

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

## Exact next action

1. Open GitHub Actions run `29880640595` and read the single annotation attached to job `88800533958`.
2. Resolve the annotation-directed account or repository restriction. Likely places to inspect, only as directed by the annotation, are personal account Billing and licensing, Actions usage, Actions budgets that stop usage at the limit, payment status, and repository Actions policy.
3. After hosted jobs can start, use one bounded lock-refresh commit or an authorized local checkout to run `pnpm install --no-frozen-lockfile` with pnpm `9.15.4`, commit only the resulting lockfile and any evidence-backed repairs, and remove any temporary workflow in the same recovery sequence.
4. Run the permanent CI gate and Playwright suite against the resulting head.
5. Continue under `ERROR_RECOVERY_PROTOCOL.md` until all mandatory gates pass, then complete the Stage 18 ledger, handoff, review, and merge sequence.

## Last known-good state

- `main` remains Stage 17 complete, verified, merged, and ledger-closed.
- PR `#33` remains draft and mergeable but unverified.
- Helper PR `#37` is stale, based on an older Stage 18 head, and did not overcome the same pre-step runner failure.
- No production deployment, production database mutation, credential change, or user-data change occurred.
