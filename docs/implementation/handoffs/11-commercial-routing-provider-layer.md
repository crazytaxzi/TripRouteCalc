# Stage 11 Handoff: Commercial-Routing Provider Layer

- Source: `docs/specification/11_COMMERCIAL_ROUTING_PROVIDER_LAYER.md`
- Date: 2026-07-20
- Implementation branch: `agent/stage-11-commercial-routing-provider`
- Pull request: `#18 Implement Stage 11 commercial-routing provider layer`
- Final verified head: `80e62513d5f2e4df59727d36c1f6df911d8d60a7`
- Final verification run: `552` (`29779628324`)
- Completion status: COMPLETE, LIVE PROVIDER VERIFICATION BLOCKED BY B-002

## Protected governance

Stage 11 was executed under `PRIME_DIRECTIVE.md` and `ERROR_RECOVERY_PROTOCOL.md`. The Stage 11 source explicitly permits completion of contracts, configuration, adapter wiring, and non-fabricated tests when credentials are unavailable, provided live verification is reported as blocked. No production provider or consumer fallback was invented.

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

No Prisma schema change or migration was required. Stage 03 already created route, leg, segment, restriction, and provider-response evidence tables. Stage 11 adds a typed repository method over the existing provider-response retention modes. The workspace lockfile was regenerated with pnpm 9.15.4 to include the routing package importer without changing external dependency versions.

## Live provider blocker

B-002 remains open. The exact missing setup is:

- selected licensed commercial-routing provider;
- confirmed commercial-vehicle entitlement;
- documented coverage and data limitations;
- documented raw, normalized, and reference retention rights;
- server-only credentials; and
- a real adapter implemented against current official provider documentation and live contract tests.

Until that setup exists, the runtime returns a blocked result and no route may be represented as commercial-provider verified or legal.

## Verification evidence

Permanent CI run `550` completed successfully against implementation head `138988858efc594f92953a394e3e646ca5cc5408`. The completed handoff then changed the branch head, so permanent CI run `552` repeated the entire gate against final documented head `80e62513d5f2e4df59727d36c1f6df911d8d60a7`:

- frozen-lockfile dependency installation: passed;
- Prisma client generation: passed;
- Prisma schema validation: passed;
- all migrations deployed to clean PostgreSQL 18: passed;
- ESLint: passed;
- strict TypeScript: passed;
- complete unit and PostgreSQL integration suite: 158 tests passed;
- production build: passed.

Recovery history remains documented in the branch commits. The final PR diff contains only the 16 permanent Stage 11 source, test, configuration, and documentation files.

## Next source after completion

`docs/specification/12_REGULATORY_RULES_AND_UPDATE_WORKFLOW.md`
