# Commercial-Routing Provider Boundary

Stage 11 establishes the provider-neutral commercial-routing boundary without selecting or fabricating a production provider.

## Live verification status

Live commercial-route verification is blocked because no licensed provider, entitlement, retention terms, coverage statement, or server-side credential has been selected. The runtime returns an explicit `PROVIDER_NOT_SELECTED` blocker. It never substitutes a consumer automobile route.

A provider may be wired only after the carrier or deployer supplies:

1. A licensed United States commercial-vehicle routing provider.
2. Documented commercial-routing entitlement and geographic coverage.
3. Allowed retention modes for raw responses, normalized snapshots, and provider references.
4. Server-side credentials stored outside client bundles and logs.
5. Known restriction, traffic, closure, terminal-access, hazmat, permit, axle, KPRA, and local-road coverage limitations.

No provider-specific environment-variable name is invented by Stage 11. The later backend/deployment stage must map its approved secret store into `ServerOnlyProviderCredential` and inject a real adapter into `createCommercialRoutingRuntime`.

## Package boundaries

- `@trip-route-calc/foundation/commercial-routing` owns provider-neutral request, location, equipment, geometry, leg, segment, restriction, unavailable-field, provider-metadata, normalization, and route-assessment contracts.
- `@trip-route-calc/routing` owns adapter interfaces, server-only credential wrapping, capability checks, bounded timeout and retry behavior, explicit setup blockers, and the no-fallback service boundary.
- `@trip-route-calc/persistence` retains provider evidence according to license capability. Raw response storage remains forbidden unless the provider license explicitly permits it.
- Test providers exist only under test directories. There is no fake production adapter.

## Route status meanings

`commercial-provider-verified` means the selected commercial provider supplied verified route segments without a blocking provider restriction or missing provider field. It does not mean the route is legally final.

Every Stage 11 result remains `blocked-pending-regulatory-evaluation` for legal finalization until the Stage 12 regulatory engine evaluates the exact route geometry and applicable versioned rules.

Consumer comparisons are separately labeled `consumer-comparison`, always blocked from commercial planning, and cannot be returned from the commercial-route operation.

## Failure behavior

The routing service exposes typed failures for:

- provider not selected;
- missing server-side credential;
- invalid licensing configuration;
- unsupported capability;
- timeout;
- rate limiting;
- provider outage;
- network failure;
- rejected request; and
- invalid provider response.

Retries are bounded to a maximum of three attempts and occur only for retryable failures. Timeout enforcement uses a promise race so an adapter cannot hang the planner by ignoring an abort signal.

## Evidence retention

`RouteProviderResponseRepository.saveNormalizedCommercialRouteEvidence` stores either:

- a normalized provider-neutral snapshot when the license permits normalized retention; or
- a provider reference when local normalized retention is not selected.

The normalized snapshot preserves provider name and version, provider request identifier, request and response timestamps, confidence, unavailable fields, route assessment, geometry, legs, segments, and restrictions. Provider credentials are never included.
