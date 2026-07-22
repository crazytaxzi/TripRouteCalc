# Stage 18 Recovery Checkpoint: External Verification Infrastructure

- Updated: 2026-07-22
- Stage: 18 - Mobile-First Trip Setup and Stop Editor
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Source state before this checkpoint update: `a701b4dd9a9575190b51e7fe80060358c8e937aa`
- Base: `main` at `94a890d6761c21489b1b48d9e4376657b8cd1687`
- Stage status: source integration complete; mandatory dependency-backed verification unavailable; not eligible to merge

## Hosted runner failure

GitHub Actions rejects the permanent `CI` workflow before checkout or any repository command executes.

Latest inspected evidence:

- run `29886457427`, job `88817901032`, completed in failure;
- zero job steps;
- no job log URL;
- direct log retrieval returned `404 BlobNotFound`;
- earlier permanent, temporary, and rerun attempts showed the same empty-step signature.

Classification remains an external account, policy, billing, quota, or hosted-runner resource restriction. No Actions result is evidence of a repository code failure because no code was executed.

## Local package infrastructure failure

The authorized local runtime provides Node.js 22 and global TypeScript 5.8.3, but it does not contain the TripRouteCalc dependency graph or pnpm.

The configured internal npm registry returned HTTP `503` on every bounded attempt, including three consecutive retries on 2026-07-22. External package and GitHub download routes are blocked from the runtime. No useful npm or pnpm cache was present.

Consequences:

- pnpm 9.15.4 could not be installed;
- the missing `packages/web` lockfile importer could not be generated safely;
- React, Zod, Vitest, Vite, ESLint, Prisma, and Playwright could not be installed;
- a PostgreSQL-backed repository gate could not be assembled.

The lockfile was not edited manually because doing so without package resolution would create unverified dependency evidence.

## Recovery and source work completed

1. Preserved PR `#33` as draft and did not merge or weaken a gate.
2. Applied the Prime Directive and Error Recovery Protocol throughout the continuation.
3. Reconciled Stage 18 against the Stage 17 API contract and the complete Source 18 requirements.
4. Implemented the complete HOS recap-return and existing sleeper-evidence workflow.
5. Implemented and mounted advanced tractor, trailer, permit, cargo, temperature, route-restriction, and secure-parking evidence.
6. Switched reusable-profile writes and commercial routing to the detailed equipment serializers.
7. Removed the obsolete flat permit field and the applied integration helper script.
8. Hardened malformed local recovery and stale public-stop recovery.
9. Preserved immutable trip revisions, structured blockers, provider-failure continuation IDs, profile-refresh isolation, controlled recalculation, and locked-stop invariants.
10. Added accessibility-only live announcement styling.
11. Added focused model, wiring, recovery, and mounted-App regressions.

The previously recorded Source 18 implementation gaps are now addressed in source. No map or detailed Source 19 timeline work was introduced.

## Verification actually executed without Actions

The rewritten source boundaries were reconstructed locally and evaluated with the installed TypeScript 5.8.3 compiler.

Completed:

- TSX parser check for `App.tsx`;
- TypeScript parser checks for `api-client.ts` and `equipment-detail-model.ts`;
- TypeScript parser checks for the three newly added recovery, wiring, and mounted-App regression files;
- strict clean-room semantic compilation using the real Stage 18 form contracts and controlled declarations at unavailable external-package boundaries;
- strict options included exact optional properties, unchecked indexed access, unused local and parameter detection, ES2022, DOM, and bundler module resolution;
- source review of the mounted editor, profile round-trip mapping, detailed domain serializer, API submission flow, and regression files.

The first strict pass found three genuine defects, which were repaired and rechecked:

- `fetch` received an explicitly undefined abort signal;
- one foundation type import was unused;
- legacy permit recovery attempted to narrow one expression and then read a fresh `unknown` expression.

The strict clean-room semantic compile was rerun against the final repaired source and completed without diagnostics. The three new regression files also passed their TypeScript parser checks without diagnostics.

This verification is stronger than a syntax-only review but is not a substitute for dependency-backed repository commands. Controlled declarations were used only where packages could not be installed.

## Mandatory results still unavailable

The following are not marked passed:

- `pnpm install --frozen-lockfile`;
- pnpm 9.15.4 lockfile refresh;
- Prisma generation;
- Prisma schema validation;
- clean PostgreSQL migration deployment;
- repository ESLint;
- full dependency-backed TypeScript typecheck;
- complete Vitest suite;
- Vite production build;
- Playwright Chromium installation;
- mobile and desktop Playwright workflow;
- prior-stage regression gate.

No item above may be reported as successful until an environment with package access actually executes it.

## Exact continuation after infrastructure recovery

1. Obtain an authorized checkout with package registry access.
2. Install pnpm `9.15.4` and run `pnpm install --no-frozen-lockfile` once to refresh the lockfile accurately.
3. Commit only the generated lockfile and evidence-backed source repairs, if any.
4. Run Prisma generation and schema validation.
5. Deploy all migrations to a clean PostgreSQL database and verify migration status.
6. Run repository lint, full typecheck, Vitest, production build, and Playwright mobile and desktop workflows.
7. Run the prior-stage regression gate.
8. Repair failures without weakening legal, evidence, tenancy, revision, or stop-order validation.
9. Complete the Stage 18 implementation ledger and completion handoff.
10. Merge only after every mandatory result is genuinely green.

## Last known safe state

- `main` remains Stage 17 complete and ledger-closed.
- PR `#33` remains draft, open, and unmerged.
- helper PR `#37` is stale and did not overcome the runner failure.
- no production deployment, production database mutation, credential change, or user-data change occurred.
