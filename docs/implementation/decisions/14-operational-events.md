# Stage 14 Architectural Decisions

## D14-001: Compose operational events through the existing HOS core

**Status:** Accepted

Operational events produce the same validated duty-event contracts used by Stages 04 through 08. Stage 14 does not duplicate HOS arithmetic. Duty status, duration, interruption qualification, shift effects, and cycle effects remain authoritative in the pure HOS core.

## D14-002: Keep location selection evidence-driven

**Status:** Accepted

Automatic placement may select only caller-supplied, verified, truck-compatible locations that provide the required capability and satisfy route-distance constraints. An explicit user-selected location remains visible as user evidence, but the public planning boundary rejects it when its recorded compatibility, capability, or placement conflicts with the event.

## D14-003: Treat fuel planning as deterministic range coverage

**Status:** Accepted

Fuel planning uses entered tank capacity, current level, MPG, route distance, reserve, and supplied verified fuel locations. It may schedule immediate origin fueling when a verified truck-compatible origin location exists. It must block uncovered gaps and must never manufacture a fuel stop, availability claim, price, or open-hours assumption.

## D14-004: Separate operational buffers from legal duration

**Status:** Accepted

Planning buffers are explicit events with their own source and explanation. They are never hidden inside drive time or represented as legal requirements. The HOS core consumes their recorded duty status independently.

## D14-005: Reuse immutable trip-revision snapshots

**Status:** Accepted

Stage 14 adds no database table or migration. Operational plans, sources, overrides, and resulting evidence are retained in the established immutable revision snapshots and append-only override records. A later operational change creates another revision rather than mutating prior evidence.

## D14-006: Apply safety guards at the public foundation boundary

**Status:** Accepted

The Stage 14 engine remains independently testable in `operational-events.ts`. A thin public composition layer adds adversarial safeguards for explicit-location compatibility, before/after-driving inspection order, origin fueling, and uncovered post-stop range classification. It composes existing calculations and does not create a second HOS or fuel engine.
