# 11. Commercial-Routing Provider Layer

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Sources 02, 09, and 10 completed
- Equipment and ordered-stop contracts stable
- Provider decision from repository audit reviewed

## Goal

Implement a provider-agnostic commercial-routing contract and at least one real, licensed-provider adapter when credentials and licensing are available. Provider details must not leak throughout the product.

## Required work

1. Define stable contracts for geocoding, route calculation, route restrictions, and optional traffic/closure data.
2. Include all required CMV inputs:
   - tractor/trailer/combined dimensions
   - axle count and weights
   - KPRA
   - trailer count
   - gross weight
   - hazmat classes
   - permits
   - avoidances
   - start, ordered stops, departure time, route policy
3. Normalize provider responses into route, legs, segments, geometry, travel time, restrictions, and verification metadata.
4. Preserve provider version, request timestamp, confidence, and unavailable fields.
5. Implement robust timeout, retry, rate-limit, credential, and provider-outage handling.
6. Never silently fall back to a consumer-car route.
7. A consumer route may exist only as a separately labeled comparison and must be excluded from legal planning.
8. Detect prohibited or unverified segments and block legal finalization where required.
9. Protect provider keys from client bundles and logs.
10. Add contract tests and test-only fixtures. No fake production adapter.
11. Document provider setup, required licensing, known coverage, and data limitations.
12. If credentials are unavailable, complete the contracts, configuration, adapter wiring, and tests that do not require fabricated production responses, then mark live verification blocked.

## Exit gate

The application can request and normalize a commercial route through one isolated adapter, or precisely reports the external setup blocking live verification without using fake legal data.

## Relevant master requirements

## 9. Commercial Route Engine

Create a provider-agnostic commercial-routing interface.

The application must be able to support a licensed commercial-routing provider without allowing provider-specific code to leak through the entire system.

Define an interface similar to:

```ts
interface CommercialRouteProvider {
  geocodeLocation(input: LocationInput): Promise<ResolvedLocation>;
  calculateRoute(request: CommercialRouteRequest): Promise<CommercialRouteResult>;
  getRouteRestrictions(routeId: string): Promise<RouteRestriction[]>;
  getTrafficEstimate?(request: TrafficRequest): Promise<TrafficEstimate>;
  getRoadClosures?(request: ClosureRequest): Promise<RoadClosure[]>;
}
```

The commercial route request must include:

* Tractor dimensions
* Trailer dimensions
* Combined dimensions
* Axle count
* Gross weight
* Axle weights when available
* KPRA
* Trailer count
* Hazmat status and classes
* Permit status
* Avoidances
* Start
* Ordered stops
* Departure time
* Preferred route policy

The route engine must account for available data concerning:

* Commercially prohibited roads
* Low clearances
* Bridge limits
* Weight-restricted roads
* Length restrictions
* KPRA restrictions
* Axle restrictions
* Truck-route designation
* STAA route eligibility
* Terminal-access routes
* Local truck prohibitions
* Seasonal roads
* Construction closures
* Weather closures
* Chain restrictions
* Tunnel restrictions
* Hazmat restrictions
* Ferry restrictions
* Border restrictions
* Permit-only roads

Never silently fall back from a commercial route to a consumer-car route.

A consumer route may be shown only as an explicitly labeled comparison and must not be used as the legal trip plan.

## 21. Validation Rules

Reject or explicitly flag:

* Negative remaining clocks
* Driving clock above the configured legal maximum
* Shift clock above the configured maximum
* Cycle clock above the selected cycle maximum
* Departure before the current duty-status start
* Stop service duration below zero
* Missing start or final
* Duplicate stop sequence numbers
* Invalid time zones
* Trailer KPRA greater than physically possible
* Trailer KPRA below physically possible minimum
* Gross weight below the sum of known axle weights
* Vehicle height, width, length, or weight missing when required for route validation
* Hazmat load with no hazmat class
* Permit-required configuration with no permit information
* Appointment end before appointment start
* Route response containing a prohibited segment

Warnings are not all equal.

A route-legality failure must block finalization.

An uncertain facility duration may lower confidence without blocking the calculation.

### Route-compliance tests

1. Oregon origin to California destination with compliant KPRA.
2. Oregon origin to California destination with excessive KPRA.
3. KPRA adjustment resolves length issue but causes axle-weight warning.
4. Route segment with 38-foot KPRA restriction.
5. Low-clearance road rejected.
6. Weight-restricted bridge rejected.
7. Consumer route differs from commercial route.
8. Route provider unavailable.
9. Local terminal access cannot be confirmed.
10. Route crosses multiple jurisdictions with different rules.

## Required completion report

Before ending the chat, provide:

1. What you inspected before coding.
2. What you implemented.
3. Every file created, changed, moved, or deleted.
4. Database migrations or data changes, if any.
5. Commands actually run.
6. Test, lint, type-check, migration, and build results.
7. Remaining blockers, missing credentials, unverified legal data, or known limitations.
8. The exact next source file that should be used in the next dedicated chat.

Do not report success for checks that were not actually run. Update the repository's implementation ledger and create a concise handoff note for this stage.
