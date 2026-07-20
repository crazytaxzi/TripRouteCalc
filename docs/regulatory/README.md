# Regulatory Rules and Update Workflow

Stage 12 provides the versioned regulatory model and deterministic compliance evaluator. It does not contain production legal rules and does not claim that any route is legal without verified commercial-route evidence and an active, effective, reviewed rule-set version.

## Separation of concerns

- `@trip-route-calc/foundation` defines regulatory source, rule-set, road-scope, machine-condition, finding, and result contracts.
- `@trip-route-calc/compliance` evaluates exact route-segment and vehicle facts. It has no provider credentials, persistence access, HOS arithmetic, API, or UI behavior.
- `@trip-route-calc/persistence` manages draft review, activation, deactivation, supersession history, tenant isolation, trip-revision rule evidence, warnings, and immutable audit records.
- Commercial-routing providers supply route geometry and restrictions. They do not decide legal compliance.
- HOS engines remain separate and do not activate regulatory exceptions or exemptions.

## Rule metadata

Every rule records:

- stable rule identifier and version;
- jurisdiction and affected CMV type;
- exact road scope: jurisdiction, named road and direction, exact segment, or geometry bounds;
- effective and expiration timestamps;
- authoritative source type, authority, title, reference, retrieved timestamp, version, and last-verified timestamp;
- machine-readable condition separate from explanatory text;
- required action, blocking behavior, and manual-verification behavior;
- active state and severity.

Supported severities are information, advisory, action required, route restricted, route illegal, and manual verification required.

## Evaluation behavior

The engine evaluates rules only when all of these are true:

1. The rule is active and effective at the evaluation timestamp.
2. The route segment is inside the rule jurisdiction.
3. The exact road scope matches the segment, direction, road identity, or geometry.
4. The configured CMV type is affected.
5. The machine condition matches the supplied vehicle, load, permit, time, and segment facts.

A rule is not applied merely because the route crosses a state. Missing facts produce visible manual-verification findings when the rule may apply. Expired rules are ignored. Draft and inactive rule sets cannot authorize legal finalization.

Provider gaps, prohibited segments, incomplete regulatory coverage, encoded geometry that cannot satisfy a geometry-bounds rule, and unverified local access remain blocking and visible.

## Administrative workflow

1. A legal researcher creates a typed draft rule set from authoritative sources.
2. Draft revisions may replace metadata and rules while preserving change and audit history.
3. Activation validates the complete typed rule set and deactivates the prior active version with explicit supersession records.
4. Active versions are immutable through the typed workflow.
5. Evaluations capture the exact persisted rule versions, structured findings, warnings, and audit snapshot against the trip revision.
6. Prior rule versions and prior trip calculations remain reproducible.

## Production data boundary

B-003 remains open. No production regulatory, permit, restriction, or official route-map data source has been selected or licensed. All automated tests use clearly labeled fixtures. Before production legal evaluation, the project must select authoritative sources, document licensing and retention terms, establish review ownership and cadence, load reviewed rules, and validate them against official examples.

## Test coverage

The Stage 12 suite covers:

- multi-jurisdiction routes without state-wide over-application;
- California-style KPRA action timing using test-only fixtures;
- named-road rules and missing road identity;
- expired rule versions;
- provider and local-access gaps;
- draft rule-set blocking;
- deterministic replay;
- typed administrative creation, revision, activation, supersession, tenant isolation, evidence capture, and audit history.
