# Stage 15 Architectural Decisions

## D15-001: Compose one chronological simulator from existing domain engines

**Status:** Accepted

Stage 15 advances one immutable simulation state in UTC whole minutes. It composes the verified commercial route, Stage 05 HOS core, Stage 10 stop processor, Stage 13 compliance actions, and Stage 14 operational events. It does not duplicate their legal or operational arithmetic. Every inserted drive, wait, service, inspection, fuel event, buffer, interruption, or rest becomes a validated duty event and an explicit ETA timeline event.

## D15-002: Preserve explicit stop-event identity

**Status:** Accepted

The ETA timeline uses the stop processor's explicit `APPOINTMENT_WAIT`, `CHECK_IN`, `SERVICE`, and `HOS_HOLD` identities when mapping stop duty events. Generic HOS event types are only a defensive fallback. This prevents an off-duty appointment wait from being mislabeled as a separate legal rest and keeps overlap evidence auditable.

## D15-003: Order in UTC and render with explicit IANA zones

**Status:** Accepted

All ordering, duration, and equality calculations use UTC instants and integer minutes. Every timeline transition also carries a local rendering in an explicit IANA time zone. A segment may start and end in different zones without changing elapsed time. Appointment interpretation remains attached to the stop's zone. DST gaps and repeated local times are resolved by the established time-domain contracts rather than by host-local date arithmetic.

## D15-004: Constrain speed with an evidence stack

**Status:** Accepted

Each segment speed decision uses the lowest applicable cap among the governed maximum, preferred planning speed, maximum average trip speed, carrier maximum, road-class speed, provider expected speed, verified provider travel time, legal or provider limit, grade cap, and urban cap. Projection factors may reduce that selected cap for expected and conservative estimates. Stage 15 never plans the whole trip at the governed maximum by default.

Verified provider travel time is preferred. When it is absent or unverified, the simulator uses the labeled fallback average and lowers confidence with a machine-readable reason. Traffic and weather are separate sourced adjustments and are not hidden inside the legal speed assumptions.

## D15-005: Keep appointments informational, never permission to violate constraints

**Status:** Accepted

Appointments can create waiting, at-risk, or missed outcomes. They cannot increase speed, extend an HOS clock, remove a compliance action, or skip a required stop. A late result remains late and explains why. This preserves the separation between customer expectations and legal planning.

## D15-006: Let qualifying stop time overlap required HOS time

**Status:** Accepted

The stop processor supplies waiting, check-in, service, and HOS-hold duty events in exact order. If entered off-duty or sleeper time already satisfies a 30-minute interruption or ten-hour reset, Stage 15 does not add duplicate time. Only the remaining legally sufficient duration is inserted, and only where the stop permits the required parking or rest.

## D15-007: Persist input and output snapshots, not mutable simulator state

**Status:** Accepted

Stage 15 adds no database table or migration. The complete simulator input is stored in the established immutable trip-revision input snapshot. The deterministic three-projection result and timeline are stored in the revision result snapshot and calculation-result relation. Replaying the same persisted input must reproduce the same snapshot. A route, stop, HOS, provider, override, or assumption change creates a new revision rather than editing prior evidence.

## D15-008: Block unsupported certainty

**Status:** Accepted

The simulator blocks when the commercial route is unusable, required conditions are missing, a restriction requires manual verification, an action cannot be placed, or legal continuation cannot be established. It does not invent route legality, cycle availability, recap timing, restart completion, sleeper-pair results, live traffic, weather, facility availability, or truck-compatible locations. Explicit Stage 06 or Stage 07 availability evidence may resolve supported HOS actions; otherwise the block remains visible.
