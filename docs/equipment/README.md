# Equipment and Load Profiles

Stage 09 introduces provider-neutral tractor, trailer, and load profiles for physical route planning. These contracts record what is known, how it was obtained, and what is still missing. They do not determine legal route status.

## Canonical measurements

The foundation package stores canonical units at every boundary:

- distance: meter
- length: inch
- weight: pound
- speed: meter-per-second
- fuel capacity: US gallon
- fuel rate: US gallon per hour
- temperature: Celsius

Conversion helpers accept supported display or entry units and normalize immediately. Persistence keeps a separate value and unit column for every numeric measurement.

## Evidence and provenance

Every safety-relevant value may be paired with a `fieldEvidence` record whose `fieldPath` identifies the value and whose source type is one of:

- `measured`
- `manufacturer-rated`
- `carrier-configured`
- `user-estimated`

Missing evidence is reported as a confidence reason. It is not silently promoted to verified fact.

A printed tandem rail marker is not KPRA evidence by itself. A reusable rail mapping must include the physical KPRA, verification source, and verification timestamp. The current rail position may be stored without a mapping, but the validator then reports that KPRA cannot be inferred.

## Validation categories

Validation separates three outcomes:

1. `blocking-error`: impossible or contradictory data that cannot be saved, such as an invalid KPRA range, axle weights above total gross, cargo beyond trailer payload, missing hazmat class, or missing explicitly required permit data.
2. `action-required-warning`: data that can be saved but needs review, such as a carrier compliance assertion without source evidence or an overhang that needs jurisdiction-specific permit review.
3. `missing-data-confidence-reason`: absent measurements or provenance that prevent a complete route input or lower confidence.

A profile may be reusable even when route input is incomplete. `routeInputReady` becomes true only when critical physical measurements are present and internally consistent.

## Legality boundary

`buildEquipmentRoutePhysicalInput` produces explicit unit-bearing physical input and always returns `legalityStatus: not-evaluated`. It does not infer axle weights, combined clearances, permits, jurisdiction rules, or legal route status. Those responsibilities belong to later route-provider and regulatory stages.

## Persistence

The existing `tractors`, `trailers`, and `loads` tables remain the identity and trip-revision reference boundary. Additive Stage 09 detail tables hold the expanded profile data, and a tenant-scoped `EquipmentProfileRepository` provides audited create, read, list, update, and delete operations.

The Prisma schema is split by domain. `schema.prisma` remains the main schema and `equipment.prisma` contains Stage 09 detail models. The migration adds foreign keys, canonical unit checks, physical consistency checks, and JSON-backed nonnumeric metadata without rewriting prior migrations.
