# Stage 18 Recovery Checkpoint: GitHub Actions runner did not start

- Date: 2026-07-21
- Stage: 18 - Mobile-First Trip Setup and Stop Editor
- Requirement: complete preflight corrections, refresh `pnpm-lock.yaml`, and run the mandatory repository and browser validation gates
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Last known branch head before this checkpoint: `70f596b2a0b7b703dcd90e28e8f416e29120ab3b`
- Base branch and commit: `main` at `94a890d6761c21489b1b48d9e4376657b8cd1687`
- Stage status: BLOCKED; not complete and not eligible to merge

## Failure

GitHub Actions workflow runs for both the permanent `CI` workflow and a temporary bounded Stage 18 preflight workflow failed before any job step started.

Observed evidence:

- CI run `29876550269`, job `88788209773`, failed in approximately three seconds.
- Stage 18 preflight run `29876550261`, initial job `88788209773`, failed in approximately three seconds.
- The preflight workflow was rerun once through the GitHub Actions API; replacement job `88788435823` moved from queued to failed with the same empty-step signature.
- The GitHub workflow-job API returned no step summaries.
- The job-log download endpoint returned `404 BlobNotFound` for both affected jobs.
- Neither run produced an artifact.
- GitHub notification email showed one job annotation but did not include the annotation text in the message body.

## Classification

- Category: external permission, account-policy, billing/quota, or hosted-runner resource constraint
- Confidence: medium
- Reason: two different workflows and a bounded rerun failed before setup, with no job steps, logs, or artifacts. Repository code and the preflight script never executed.
- Exact GitHub account annotation: unavailable through the connected API and email body; it must be opened in the GitHub Actions run UI before selecting a billing, quota, policy, or account remedy.

## Recovery actions performed

1. Preserved PR `#33` and its Stage 18 implementation branch.
2. Reopened and applied `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`.
3. Reconciled the active branch, PR, Stage 18 specification, shared guardrails, and implementation status.
4. Identified and corrected two defects in the temporary preflight workflow:
   - the `pull_request.branches` filter incorrectly targeted the head branch instead of PR base `main`;
   - the commit step referenced a trigger file that did not exist.
5. Triggered the corrected workflow and observed the same pre-step hosted-runner failure.
6. Performed one bounded rerun using the GitHub Actions API; the same signature returned.
7. Removed the temporary self-mutating preflight workflow so the PR does not retain diagnostic workflow debris.
8. Preserved the current implementation and did not weaken, skip, or claim any validation gate.

## Pending bounded preflight corrections

The following evidence-backed corrections were prepared but did not execute because the hosted runner never started:

1. `packages/web/src/types.ts`
   - make the four optional reusable-profile `id` fields explicit as `string | undefined` for `exactOptionalPropertyTypes`.
2. `packages/web/src/model.ts`
   - initialize `route.ruleSetVersion` in the default draft;
   - surface an error when the reviewed rule-set version is empty.
3. `packages/web/src/api-client.ts`
   - omit stop `id` and `sequence` without unused destructuring bindings;
   - preserve unsaved later stops while persisting stops sequentially;
   - remove provider route `assessment` before domain reassessment without an unused binding;
   - include optional confidence only when present.
4. `packages/web/e2e/planner.spec.ts`
   - use the exported Playwright `Page` type instead of indexing the test callback parameter type.
5. `packages/web/src/model.test.ts`
   - replace the non-null assertion for the locked start stop with an explicit guard.
6. `pnpm-lock.yaml`
   - refresh with pnpm `9.15.4` so the new `packages/web` importer and all exact dependency resolutions are represented.

## Validation state

Not run successfully for the current Stage 18 head:

- `pnpm install --frozen-lockfile`
- Prisma generation and schema validation
- clean database migration deployment
- ESLint
- TypeScript type checking
- complete Vitest suite
- production build
- Playwright Chromium installation
- mobile and desktop Playwright workflow
- prior-stage regression gate

No item above may be reported as passed until a runner or equivalent authorized local environment actually executes it.

## Exact next action

1. Open either GitHub Actions run `29876550269` or `29876550261` and read the single job annotation.
2. Resolve the indicated GitHub account-level Actions restriction. Check personal account Billing and licensing, Actions usage, budgets with `Stop usage when budget limit is reached`, payment status, and repository Actions policy as directed by the annotation.
3. After hosted jobs can start, reintroduce a one-use bounded preflight workflow or apply the listed source corrections in one controlled commit, run `pnpm install --no-frozen-lockfile` with pnpm `9.15.4`, commit the refreshed lockfile, and remove the temporary workflow in the same recovery sequence.
4. Run the permanent Stage 18 CI gate including Playwright.
5. Inspect failures under `ERROR_RECOVERY_PROTOCOL.md`, complete adversarial review, write the Stage 18 handoff and ledger update, then merge only after all mandatory gates pass.

## Last known-good state

- `main` remains Stage 17 complete, verified, merged, and ledger-closed.
- PR `#33` remains draft and mergeable but unverified.
- No production deployment, database mutation, credential change, or user-data change occurred.
