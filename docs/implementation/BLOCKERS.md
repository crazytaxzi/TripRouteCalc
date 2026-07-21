# Blockers

## B-001: Canonical GitHub repository not yet created

**Severity:** High  
**Status:** Resolved  
**Resolved:** 2026-07-19

The private canonical repository now exists at `crazytaxzi/TripRouteCalc`, uses `main` as its default branch, and contains the complete specification pack and implementation ledger. The temporary import workflow and staging artifacts were removed after successful verification.

## B-002: Commercial routing provider not selected

**Severity:** Expected future blocker  
**Status:** Open for later routing stages

A legal CMV route cannot be verified until a commercial-routing provider and credentials are selected. No provider may be replaced by a consumer-route fallback.

## B-003: Regulatory data sources not selected

**Severity:** Expected future blocker  
**Status:** Open for later compliance stages

State and local rules must be versioned, effective-dated, source-attributed, and reviewable. Stage 03 provides the storage and change-history structure, but provider or licensed production-data decisions remain open.

## B-004: Deployment target not selected

**Severity:** Low during foundation and persistence work  
**Status:** Deferred

Docker Compose now provides a reproducible local PostgreSQL service, but hosting, secrets management, backup automation, recovery objectives, retention periods, and production database infrastructure remain undecided.

## Stage 02 blocker review

**Status:** No active Stage 02 blocker

Stage 02 required no production provider credentials, regulatory data, database service, migration target, or deployment target. The shared foundation package, lockfile, tests, and CI are complete.

## Stage 03 blocker review

**Status:** No active Stage 03 blocker

Stage 03 required a reproducible PostgreSQL migration target but did not require production hosting, routing credentials, or production regulatory data. PostgreSQL 18, Prisma 7, the committed migration, tenant-scoped repositories, append-only evidence, integration tests, and CI verification are complete. B-002 through B-004 remain visible later-stage concerns and must not be disguised with fake providers, placeholder legal rules, or unverified operational claims.

## Stage 04 blocker review

**Status:** No active Stage 04 blocker

Stage 04 required no commercial-routing provider, production regulatory source, authentication system, or deployment target. The complete driver departure state, timestamped duty-event history, provenance, tenant-scoped append-only persistence, PostgreSQL migration, unit and integration tests, lint, type-check, and build are verified. B-002 through B-004 remain visible later-stage concerns and must not be disguised with inferred clocks, fake providers, placeholder legal rules, or unverified operational claims.

## Stage 05 blocker review

**Status:** No active Stage 05 blocker

Stage 05 required current official federal property-carrying HOS verification but no commercial-routing provider, production regulatory feed, authentication system, new database migration, or deployment target. Current FMCSA guidance was checked on 2026-07-20, the pure engine and complete boundary suite passed repository CI, and no mandatory Stage 05 requirement remains blocked. B-002 through B-004 remain visible future concerns.

## Stage 06 blocker review

**Status:** No active Stage 06 blocker

Stage 06 required complete timestamped duty history, an explicit carrier-designated home-terminal regulatory boundary, and current federal cycle and restart verification. Those inputs and authorities were sufficient to implement and verify rolling 60-hour/7-day and 70-hour/8-day calculations, recap timing, discrepancy reporting, cycle blocking, and explicitly selected 34-hour restart behavior. No production routing provider, regulatory feed, authentication system, new database migration, or deployment target was required.

## Stage 07 blocker review

**Status:** No active Stage 07 blocker

Stage 07 required accepted Stage 04 sleeper metadata, the verified Stage 05 core result, explicit user selection, supporting adverse-condition context, carrier targets, and current federal guidance. Those inputs were sufficient to implement and verify split-sleeper qualification, explicit 7/3 and 8/2 selection, current July 1, 2026 rest-period choice guidance, adverse-driving-condition extensions, stricter carrier caps, rest-preference conflicts, and unsupported-rule warnings. No production routing provider, regulatory feed, authentication system, database migration, or deployment target was required.

B-002 through B-004 remain visible future concerns. Pilot-program participation, personal conveyance, yard move, short haul, the 16-hour exception, agriculture, emergency declarations, and other unsupported rules are deliberately blocked from automatic clock alteration rather than hidden behind approximations.

The local container's outbound DNS and package access remained unavailable, but connected GitHub and GitHub Actions supplied a complete recovery and verification path without weakening requirements or claiming unobserved local success.

## Stage 08 blocker review

**Status:** No active Stage 08 blocker

Stage 08 required accepted HOS contracts and engines, a clean PostgreSQL integration target, and the existing strict repository gates. Those inputs were sufficient to add and verify the complete master-scenario, boundary, replay, isolation, timezone, and persistence-mapping suite. No provider credential, regulatory feed, production deployment, schema migration, or new legal interpretation was required.

The expanded suite exposed no verified production HOS defect. Commercial routing, production regulatory data, and deployment remain visible future blockers and were not replaced with mocks or approximations.

## Stage 09 blocker review

**Status:** No active Stage 09 blocker

Stage 09 required explicit physical tractor, trailer, and load facts with provenance and immutable persistence. Those contracts, validation rules, additive profile details, audited tenant-scoped CRUD, and regression coverage are complete. B-002 and B-003 remain intentionally deferred because physical equipment evidence is not route-legality evidence.

## Stage 10 blocker review

**Status:** No active Stage 10 blocker

Stage 10 required deterministic ordered stops, appointment and facility-hour handling, independent waiting, check-in, and service duty statuses, HOS overlap, and immutable stop-detail persistence. These are implemented and verified without requiring live appointment-confirmation, parking, or facility-history providers. Missing live provider evidence remains visible and is never replaced with fabricated facility availability.

## Stage 11 blocker review

**Status:** Implementation complete; live verification blocked by B-002

Stage 11 completed the provider-neutral commercial-routing request, normalized result, timeout, retry, failure, evidence-retention, and no-consumer-fallback boundaries. A real commercial route still cannot be verified until B-002 supplies a licensed provider, documented entitlement and coverage, retention terms, server-only credentials, and a production adapter.

## Stage 12 blocker review

**Status:** Implementation complete; production regulatory evaluation blocked by B-003

Stage 12 completed the data-driven regulatory rule contracts, scoped evaluation, administrative lifecycle, source attribution, immutable evidence, and fixture-based acceptance suite. Production legal evaluation remains blocked until B-003 supplies reviewed authoritative data, licensing, legal-research ownership, update cadence, and an accepted production corpus.

## Stage 13 blocker review

**Status:** Implementation complete; production California legal evaluation blocked by B-003

Stage 13 completed the KPRA adjustment, confirmation, acknowledgement, revision, and full compliance-revalidation workflow. Test-only sourced examples prove behavior, not California legal authority. No production KPRA, axle, bridge, local-route, or permit threshold was invented.

## Stage 14 blocker review

**Status:** No active Stage 14 implementation blocker

Stage 14 required structured operational events, explicit HOS effects, deterministic reserve-aware fuel planning, route-aware placement constraints, separate planning buffers, and immutable revision evidence. Those mandatory requirements are implemented and verified.

B-002 remains open for live commercial-route and route-aware operational-location evidence. No live fuel, parking, scale, maintenance, border, meal, shower, traffic, closure, or facility provider is configured. Supplied fixture locations are test evidence only. The planner blocks missing or unreachable availability and never fabricates an operational stop.

B-003 remains open for production legal-route evaluation, but Stage 14 added no legal threshold and did not require production regulatory data. B-004 remains deferred and did not block the Stage 14 domain, persistence, or CI exit gate.

## Stage 15 blocker review

**Status:** No active Stage 15 implementation blocker

Stage 15 required a deterministic event simulator, constrained commercial speed model, three projections, UTC/IANA chronology, DST and time-zone behavior, route/HOS/stop/compliance/operational composition, explicit overlap handling, complete timeline evidence, and immutable persisted replay. Those mandatory requirements are implemented and verified.

B-002 remains open for live commercial-route timing, traffic, weather, closure, and route-aware facility evidence. The Stage 15 simulator consumes supplied verified provider and condition evidence, labels conservative fallback timing, lowers confidence, or blocks when required evidence is unusable. It never replaces missing commercial evidence with a consumer route or fabricated live conditions.

B-003 remains open for production legal-route and restriction evaluation. Test-only sourced rules and normalized route fixtures prove deterministic behavior, not production legality. Stage 15 does not invent regulatory authority, speed limits, route restrictions, permits, recap timing, restart completion, or sleeper qualification.

B-004 remains deferred and did not block the pure simulator, immutable revision replay, PostgreSQL integration test, or permanent CI exit gate. No new Stage 15 blocker was created.

## Stage 16 blocker review

**Status:** No active Stage 16 implementation blocker

Stage 16 required deterministic confidence classification, structured reasons, safe evidence references, constraint explanations, legal-conclusion withholding, persistence alignment, migration, replay, and complete factor coverage. Those mandatory requirements are implemented and verified.

B-002 remains open. Stage 16 can classify missing commercial-route, traffic, weather, closure, local-access, provider-restriction, and facility evidence as moderate, low, or unverified, but classification does not supply the missing provider, credential, entitlement, retention terms, or live evidence.

B-003 remains open. Stage 16 can explain when legal-critical evidence is missing or requires manual verification and can withhold a legal conclusion, but it does not create a reviewed production regulatory corpus, legal authority, restriction feed, verification cadence, or permit evidence.

B-004 remains deferred. The in-place confidence migration, immutable JSON evidence, and permanent CI gate are complete, but production hosting, secrets management, backups, recovery objectives, retention policy, and operational infrastructure remain undecided.

No new Stage 16 blocker was created. Confidence and explanation behavior must not be represented as resolution of missing route, regulatory, live-condition, authentication, privacy, API-redaction, or deployment evidence.

## Stage 17 blocker review

**Status:** No active Stage 17 implementation blocker

Stage 17 required an authenticated and tenant-scoped REST boundary, strict request validation, stable opaque public identifiers, immutable revision writes, concurrency protection, persistent idempotency, structured errors, OpenAPI documentation, and PostgreSQL-backed success and failure acceptance scenarios. Those mandatory requirements are implemented, verified, and merged.

B-002 remains open. The API exposes the commercial-routing boundary and returns explicit provider setup failures, but no licensed production provider, entitlement, coverage agreement, retention terms, server-only credential, or live adapter exists. Consumer routing remains prohibited as a fallback.

B-003 remains open. The API exposes versioned regulatory evidence and structured legal or manual-verification blocks, but it does not create a reviewed production regulatory corpus, restriction feed, legal-research ownership, verification cadence, or official acceptance corpus.

B-004 remains deferred. Stage 17 includes an in-memory fixed-window limiter and a verified bearer-token boundary, but distributed rate limiting, full identity lifecycle, production secrets, hosting, backups, recovery objectives, and deployment infrastructure remain future work.

No new Stage 17 blocker was created. The test providers and rule fixtures prove deterministic boundary behavior only and must never be represented as production route or legal evidence.