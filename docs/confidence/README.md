# Confidence, Explanations, and Data Quality

Stage 16 provides a deterministic confidence model and an audit-stable explanation layer. Confidence is evidence classification, not trip status, legality, a probability, or a decorative percentage.

## Confidence levels

Every ETA projection carries one of four levels:

- `HIGH`: no documented factor lowers the projection.
- `MODERATE`: one documented moderate uncertainty affects the projection.
- `LOW`: at least one major uncertainty or at least two independent moderate uncertainties affect the projection.
- `UNVERIFIED`: legal-critical evidence is missing, a route or rule requires manual verification, or the available evidence cannot support a legal conclusion.

`BLOCKED` remains a projection status. It is not a confidence level. A blocked projection may also be `UNVERIFIED`, but the two fields answer different questions.

## Deterministic classification

`packages/foundation/src/confidence.ts` owns the Stage 16 classification method, `stage-16-rules-v1`.

Each machine-readable reason has:

- a stable code;
- a category;
- a maximum permissible confidence level;
- one or more structured evidence references;
- a user-facing explanation; and
- a technical explanation.

The classifier applies these rules in order:

1. Any `UNVERIFIED` reason produces `UNVERIFIED`.
2. Any `LOW` reason produces `LOW`.
3. Two or more independent `MODERATE` reasons produce `LOW`.
4. One `MODERATE` reason produces `MODERATE`.
5. No reasons produce `HIGH`.

Reasons are deduplicated and ordered deterministically by severity, code, and evidence reference. A caller may strengthen a factor but cannot weaken it below the documented rule.

## Reason categories

Stage 16 distinguishes:

- `LEGAL_BLOCKING_FAILURE`
- `MANUAL_VERIFICATION_REQUIRED`
- `OPERATIONAL_UNCERTAINTY`
- `MISSING_LIVE_DATA`
- `USER_ESTIMATED_INPUT`

A legal conclusion is unavailable when confidence is `UNVERIFIED` or any reason belongs to a legal-blocking or manual-verification category.

## Required factors

The documented factor table includes:

- missing axle weights;
- unknown KPRA;
- unknown trailer dimensions;
- missing appointment windows;
- unavailable live traffic;
- unavailable weather;
- average-speed fallback;
- unknown facility service time;
- unverified local truck access;
- missing permit information;
- unavailable provider restrictions;
- partially resolved addresses;
- route segments requiring manual verification;
- user-estimated inputs;
- unresolved legal inputs;
- optional operational events that could not be placed;
- reduced provider confidence; and
- reduced-confidence external adjustments.

No unsupported confidence percentage is calculated.

## Evidence references

Public evidence references use stable, non-secret identifiers and one of these kinds:

- `INPUT`
- `EVENT`
- `RULE`
- `ROUTE_SEGMENT`
- `STOP`
- `REVISION`
- `PROVIDER`

The public reference helper rejects credential-like material including authorization headers, bearer values, passwords, tokens, API keys, client secrets, and private keys. Internal database identifiers are not required for user-facing explanations. Sequence-based event, stop, leg, and segment references are preferred where possible.

## ETA integration

Each Stage 16 ETA projection returns:

- `confidence`;
- `confidenceAssessment`;
- structured `confidenceReasons`;
- independent `blockingReasons`;
- structured `constraintExplanations`; and
- the original timeline and calculation evidence.

Constraint explanations are generated from the Stage 15 timeline and preserve references to the relevant events, stops, route segments, rules, and revision. The explanation categories cover:

- independent HOS constraints;
- stop clock effects;
- qualifying interruptions;
- qualifying rest;
- appointment waiting;
- compliance actions;
- speed fallbacks;
- final local-time results;
- route constraints; and
- operational events.

Prose supplements the structured result. It never becomes the only calculation output.

## Persistence

The existing calculation-result JSON columns retain structured confidence reasons and the complete deterministic simulator snapshot. Stage 16 changes the PostgreSQL `CalculationConfidence` enum values:

- `medium` becomes `moderate`;
- `blocked` becomes `unverified`.

The migration renames existing enum values in place. It does not delete or rewrite calculation evidence. Projection status remains separately stored inside the result snapshot.

## Verification

The Stage 16 suites verify:

- all four levels;
- single and accumulated uncertainty escalation;
- legal-conclusion withholding;
- deterministic reason ordering and deduplication;
- complete factor-rule coverage;
- required trip-input factors;
- credential-safe references;
- rule-strength protection;
- structured ETA reasons and explanations;
- HOS, stop, appointment, fallback, route, revision, and local-time references;
- immutable persisted replay; and
- clean migration from the prior enum vocabulary.

The permanent repository gate remains:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm lint:source
pnpm typecheck:source
pnpm test:source
pnpm build:source
```
