# California KPRA and Axle Revalidation Workflow

Stage 13 adds a reusable adjustment workflow over the Stage 09 equipment facts and Stage 12 regulatory evaluator. It does not embed a California limit in production code. Every maximum comes from the active, effective, reviewed rule that applies to the exact selected route segment.

## Physical measurement boundary

KPRA means the physical distance from the trailer kingpin to the rearmost trailer axle or axle-group reference required by the sourced rule. A printed rail position is not KPRA unless the equipment profile contains a verified rail-position-to-physical-KPRA mapping.

The workflow consumes:

- the physically verified current KPRA;
- the trailer minimum and maximum achievable KPRA, when known;
- sliding-tandem capability;
- drive, trailer, steer, and total gross weights;
- load-distribution confirmation;
- exact commercial-route segments and their verification evidence; and
- the active regulatory rule-set version and authoritative source metadata.

## Assessment

`assessKpraAdjustment` runs the existing regulatory evaluator and considers only blocking KPRA findings produced for the selected route. When several applicable rules match, the lowest sourced maximum is the controlling action threshold.

A generated action records:

- original immutable trip revision;
- route, finding, rule, rule-set, and rule version;
- exact affected segment and jurisdiction;
- authoritative source and verification date;
- entered and allowed physical KPRA;
- physical adjustment range and sliding capability;
- last reasonable adjustment location, when supplied by route evidence;
- adjustment and reroute choices; and
- all facts that must be reconfirmed after movement.

Adjustment is offered only when the equipment profile says the tandem can slide and the recorded minimum achievable KPRA can reach the sourced limit. Otherwise rerouting is required.

## Required post-adjustment confirmation

Moving the tandem never proves legal compliance by itself. Before revalidation the user must record:

1. a newly measured physical KPRA;
2. drive axle weight;
3. trailer axle weight;
4. total gross combination weight;
5. confirmation that load distribution remains acceptable; and
6. the measurement or scale source.

The confirmation must be attached to a new immutable trip revision. The original revision and its finding remain unchanged.

## Revalidation

`revalidateKpraAdjustment` replaces only the confirmed physical KPRA and weight facts, retains the same route and rule-set version, and reruns the complete regulatory evaluator.

Possible outcomes are:

- `resolved`: no KPRA, axle, gross, bridge, or other blocking finding remains;
- `adjustment-still-required`: the confirmed KPRA still violates an applicable sourced rule;
- `axle-revalidation-blocked`: KPRA is resolved but an axle, gross, or bridge rule still blocks;
- `other-compliance-blocked`: another route or regulatory finding still blocks;
- `reroute-required`: rerouting was selected or the physical configuration cannot reach the limit; or
- `confirmation-invalid`: revision, action, measurement, load-distribution, or weight evidence is inconsistent.

Only `resolved` may allow legal finalization.

## Persistence and audit evidence

`KpraAdjustmentRepository.captureAdjustmentEvidence` uses existing append-only records rather than introducing a parallel legal-data store. It verifies that:

- both revisions belong to the same tenant and trip;
- the recalculation revision follows the original revision;
- the rule-set version is retained;
- the original compliance warning exists and its source matches; and
- the same user has not already captured the acknowledgement.

It then writes:

- a warning acknowledgement against the original finding; and
- an audit event on the recalculation revision containing the action, source, rule versions, entered and confirmed measurements, axle facts, acknowledgement, revalidation result, and original warning identifier.

## Fixture-only limits

The Stage 13 acceptance suite includes clearly labeled 40-foot and stricter 38-foot scenarios to verify exact-segment precedence and the adjustment flow. Those values are not production defaults or legal assertions. Production behavior remains blocked by B-003 until authoritative sources, review ownership, licensing, verification cadence, and reviewed rule data exist.
