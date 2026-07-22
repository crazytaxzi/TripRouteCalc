# Stage 18 Advanced Evidence Progress

- Date: 2026-07-21
- Repository: `crazytaxzi/TripRouteCalc`
- Branch: `agent/stage-18-mobile-trip-setup-ui`
- Pull request: `#33`
- Status: source work in progress; pull request remains draft and unverified

## Completed in this recovery slice

### HOS evidence is implemented end to end

The Stage 18 web workflow now has accepted form, recovery, editor, mapping, and regression coverage for:

- expected cycle recap returns;
- source duty dates;
- local recap availability times converted with the departure IANA time zone;
- returned cycle minutes;
- existing sleeper periods;
- local sleeper start and end times converted with the departure IANA time zone;
- recorded duration, short or long candidate role, optional pair ID, evidence source, and explanation.

Older version 1 and version 2 drafts receive empty evidence collections during migration. No recap hours or sleeper history are invented. Incomplete or contradictory evidence remains subject to the central HOS validator.

### Transaction and stop-editor corrections remain preserved

The branch still contains the previously completed corrections for:

- resumable immutable trip revisions;
- real Stage 17 nested stop response handling;
- structured HTTP 422 blockers;
- synchronized trip and stop IDs saved before route-provider calls;
- successful calculation results surviving secondary profile-refresh failure;
- locked intermediate stops retaining their absolute positions across add, insert, duplicate, remove, button move, and drag operations;
- debounced and abortable automatic recalculation;
- bearer-token exclusion from local recovery.

### Advanced equipment and load contracts are implemented below the App mount

Committed source now provides:

- advanced tractor form fields and saved-profile round-trip for VIN, wheelbase, California compliance status and evidence, and notes;
- advanced trailer form fields and saved-profile round-trip for current rail position, exact rail-to-KPRA mappings, liftgate, special equipment, and notes;
- advanced load form fields and saved-profile round-trip for overhang, Fahrenheit temperature requirements, exact permits with jurisdiction and restrictions, escort requirements, route restrictions, secure or high-value parking, and notes;
- detailed domain serialization through the existing foundation validators;
- detailed commercial route equipment construction;
- additive detailed local recovery that preserves rich fields while migrating legacy flat permit identifiers;
- detailed validation composed with the existing Stage 18 validation summary;
- standalone model and editor regression coverage.

The planning client now uses the detailed serializer for profile writes and commercial route requests. It also imports the detailed draft saver explicitly, correcting a static missing-import defect in the prior client.

## Remaining source integration

The advanced equipment editor and composed recovery/validation facade are committed but are not yet mounted in `packages/web/src/App.tsx` because the connected GitHub Contents action stopped exposing the live App blob SHA required for a safe replacement.

A deterministic patch script is committed at:

- `scripts/apply-stage18-advanced-equipment-ui.mjs`

It performs only two reviewed changes:

1. switches App recovery, saving, and validation to `trip-form-model.ts` while retaining the existing reducer and draft factory;
2. mounts `EquipmentDetailEditor` immediately before the ordered-stop section.

The script validates exact source anchors and refuses to write when the App has drifted or is already integrated.

Authorized continuation command:

```bash
node scripts/apply-stage18-advanced-equipment-ui.mjs
```

After running it, the resulting `App.tsx` must be reviewed and committed. The patch script should then be removed before Stage 18 closure unless the project explicitly retains it as a migration utility.

## Execution blocker

The latest directly inspected hosted run remains GitHub Actions run `29884806566`, job `88813070441`. It failed before checkout with no step summaries and no job log URL, matching the prior account, policy, billing, quota, or hosted-runner failure signature.

The current source after this addendum has not been executed by GitHub Actions. `pnpm-lock.yaml` also still requires an authorized pnpm `9.15.4` refresh for the web workspace importer.

## Mandatory continuation

1. Apply and review `scripts/apply-stage18-advanced-equipment-ui.mjs` in an authorized checkout or through an authenticated Git commit action that can replace `App.tsx` safely.
2. Add an App-level autosave and validation regression for the mounted advanced editor.
3. Reconcile the detailed serializer tests against actual TypeScript, ESLint, Vitest, and Playwright output.
4. Refresh `pnpm-lock.yaml` with pnpm `9.15.4`.
5. Resolve the GitHub Actions pre-step restriction and execute the complete Stage 18 gate.
6. Perform final adversarial review, update the implementation ledger, write the completion handoff, and merge only after every mandatory check passes.

No test, build, migration, or browser gate is represented as passed in this document.
