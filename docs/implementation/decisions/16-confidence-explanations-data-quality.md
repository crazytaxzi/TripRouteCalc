# Stage 16 Architectural Decisions

## D16-001: Confidence is independent from projection status

**Status:** Accepted

Confidence describes the quality and verification state of the evidence supporting a projection. Projection status describes whether the simulation completed or blocked. `BLOCKED` is therefore not a confidence level. The Stage 16 levels are exactly `HIGH`, `MODERATE`, `LOW`, and `UNVERIFIED`.

## D16-002: Use deterministic classification rather than percentages

**Status:** Accepted

Stage 16 uses the documented `stage-16-rules-v1` classification method. Each reason has a maximum permissible confidence level. Any unverified factor dominates, any low factor produces low confidence, two independent moderate factors accumulate to low, one moderate factor produces moderate, and no factors produce high. No unsupported confidence percentage is generated.

## D16-003: Keep reasons structured and prose secondary

**Status:** Accepted

Every reason contains a stable code, category, evidence references, user explanation, and technical explanation. Plain-language prose supplements the structured output and may be rendered differently later, but it is never the only calculation evidence.

## D16-004: Separate legal, verification, and operational uncertainty

**Status:** Accepted

Reason categories distinguish legal blocking failures, manual verification requirements, operational uncertainty, missing live data, and user-estimated inputs. A legal conclusion is unavailable whenever confidence is unverified or a legal-blocking/manual-verification reason exists.

## D16-005: Public explanations use safe references

**Status:** Accepted

User-facing references identify evidence by semantic input path, event sequence, stop sequence, route leg/segment sequence, rule reference, revision reference, or provider evidence label. The public-reference boundary rejects credential-like content. Explanations do not require database primary keys, authorization material, provider secrets, or raw internal identifiers.

## D16-006: Generate constraint explanations from accepted engines

**Status:** Accepted

Stage 16 reads the Stage 15 event timeline and accepted HOS, stop, route, compliance, and operational-event outputs. It does not independently recalculate legal clocks, appointments, route restrictions, or event durations. Explanations describe the evidence that the accepted engines already produced.

## D16-007: Preserve explicit explanation categories

**Status:** Accepted

Constraint explanations use stable categories for HOS constraints, stop clock effects, qualifying interruptions, rests, appointment waits, compliance actions, speed fallbacks, final local time, route constraints, and operational events. Each explanation carries exact structured references.

## D16-008: Persist structured reasons in existing JSON evidence

**Status:** Accepted

No new confidence-reason table is required. Calculation results already retain confidence reasons and deterministic result snapshots as JSON evidence. Stage 16 stores the structured reason objects there and relies on immutable trip revisions for audit and replay.

## D16-009: Rename legacy enum values in place

**Status:** Accepted

The PostgreSQL confidence enum is migrated from `HIGH/MEDIUM/LOW/BLOCKED` to `HIGH/MODERATE/LOW/UNVERIFIED`. The migration renames `medium` to `moderate` and `blocked` to `unverified` in place. Projection blocking remains represented separately inside the result snapshot.

## D16-010: Uncertainty may strengthen but never weaken

**Status:** Accepted

A caller may strengthen a documented factor when additional context makes the uncertainty more serious. A caller cannot override a rule to claim a higher confidence level than the documented factor permits.
