# Stage 11 Handoff: Commercial-Routing Provider Layer

- Source: `docs/specification/11_COMMERCIAL_ROUTING_PROVIDER_LAYER.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-11-commercial-routing-provider`
- Pull request: `#18 Implement Stage 11 commercial-routing provider layer`
- Completion status: IMPLEMENTATION COMPLETE, LIVE PROVIDER VERIFICATION BLOCKED, REPOSITORY VERIFICATION PENDING

## Protected governance

Stage 11 is executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. The Stage 11 source explicitly permits completion of contracts, configuration, adapter wiring, and non-fabricated tests when credentials are unavailable, provided live verification is reported as blocked. No production provider or consumer fallback has been invented.

## Requirement traceability

| ID | Requirement | Implementation | Validation | Status |
|---|---|---|---|---|
| R11-01 | Stable geocoding, route, restriction, traffic, and closure contracts | `foundation/commercial-routing.ts`, `routing/commercial-routing-service.ts` | foundation and routing contract tests | satisfied |
| R11-02 | Complete CMV request inputs | `CommercialRouteRequestSchema` and equipment schema | invalid axle, ordering, hazmat, and permit cases | satisfied |
| R11-03 | Normalize route, legs, segments, geometry, time, restrictions, verification | `assessCommercialRoute` | verified, prohibited, unverified, and consumer cases | satisfied |
| R11-04 | Preserve version, request timestamps, confidence, unavailable fields | normalized result and typed persistence method | PostgreSQL integration test | satisfied |
| R11-05 | Timeout, retry, rate-limit, credential, outage handling | `CommercialRoutingService` and typed provider errors | bounded retry, timeout, credential, and error tests | satisfied |
| R11-06 | No silent consumer fallback | separate provider methods and commercial result guard | consumer fallback rejection test | satisfied |
| R11-07 | Consumer route separately labeled and excluded | `consumer-comparison` assessment | comparison test | satisfied |
| R11-08 | Block prohibited or unverified route planning/finalization | route assessment | prohibited and unverified tests | satisfied |
| R11-09 | Protect keys from bundles and logs | `ServerOnlyProviderCredential` and secret sanitization | string, JSON, and error-redaction tests | satisfied |
| R11-10 | Contract tests and test-only fixtures, no fake production adapter | tests under package test directories only | repository inspection and dependency-isolation checks | satisfied |
| R11-11 | Provider setup, licensing, coverage, limitations documented | `docs/routing/README.md` | documentation inspection | satisfied |
| R11-12 | Credentials unavailable path | explicit blocked runtime and B-002 update | runtime blocker test | satisfied; live verification blocked |

## Implemented scope

- Provider-neutral CMV request and normalized result contracts.
- Required tractor, trailer, combined-dimension, axle, weight, KPRA, hazmat, permit, avoidance, stop-order, departure, and route-policy inputs.
- Geometry, leg, segment, restriction, verification, confidence, and unavailable-field normalization.
- Route assessment that distinguishes commercial planning usability from legal finalization.
- Isolated provider interface and runtime wiring.
- Server-only credential wrapper with redacted string and JSON behavior.
- Bounded retry and timeout enforcement, including adapters that ignore abort signals.
- Explicit credential, rate-limit, outage, network, request, capability, and invalid-response errors.
- Separate consumer-comparison operation with no commercial fallback.
- Typed normalized provider-evidence retention through the existing tenant-scoped persistence boundary.
- Test-only provider fixtures; no production adapter or fake route data.

## Database and data changes

No Prisma schema change or migration is required. Stage 03 already created route, leg, segment, restriction, and provider-response evidence tables. Stage 11 adds a typed repository method over the existing provider-response retention modes. The workspace lockfile was regenerated with pnpm 9.15.4 to include the new routing package importer without changing external dependency versions.

## Live provider blocker

B-002 remains open. The exact missing setup is:

- selected licensed commercial-routing provider;
- confirmed commercial-vehicle entitlement;
- documented coverage and data limitations;
- documented raw, normalized, and reference retention rights;
- server-only credentials; and
- a real adapter implemented against current official provider documentation and live contract tests.

Until that setup exists, the runtime returns a blocked result and no route may be represented as commercial-provider verified or legal.

## Verification pending

CI run `522` passed frozen install, Prisma generation and validation, clean PostgreSQL migration deployment, and ESLint. ERP then corrected the widened provider-verification union and declared the normalized route collections as readonly, matching the frozen runtime result. The strict TypeScript diagnostic now passes with no compiler errors. All temporary diagnostics are removed and the complete permanent gate is running on the identical repaired source.

The complete repository gate must pass before the stage is marked complete:

- frozen-lockfile install;
- Prisma generation and validation;
- clean PostgreSQL 18 migration deployment;
- ESLint;
- strict TypeScript type-check;
- complete unit and integration tests; and
- production build.

## Next source after completion

`docs/specification/12_REGULATORY_RULES_AND_UPDATE_WORKFLOW.md`
