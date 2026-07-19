# 23. Documentation, Deployment, Backup, and Operations

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Implementation behavior and commands are substantially stable
- Earlier handoffs and decisions available

## Goal

Create accurate documentation that matches the implemented system and gives an operator everything needed to configure, migrate, test, deploy, back up, restore, update regulatory data, and understand limitations.

## Required work

1. Create or update every document listed in the master specification.
2. Base commands, paths, variables, ports, and services on the real repository.
3. Document local and production-like setup.
4. Document every environment variable without exposing values.
5. Document clean database migration, upgrade, rollback considerations, backup, and restore.
6. Document commercial-route provider licensing, credentials, capabilities, limits, and failure behavior.
7. Document regulatory rule creation, source review, versioning, approval, deactivation, and verification dates.
8. Document HOS event effects on drive, shift, cycle, interruption, and sleeper qualification.
9. Include calculation examples derived from tests, not invented behavior.
10. Document security, privacy, monitoring, logs, rate limits, data retention, and administrative roles.
11. Document known unsupported modes and manual-verification cases.
12. Include the required safety/legal disclaimer.
13. Verify every documented command.
14. Remove stale or contradictory documentation rather than leaving competing guides.

## Exit gate

A new developer or operator can reproduce the supported environment from the documentation, and the docs do not claim features or checks that are absent.

## Relevant master requirements

## 28. Required Documentation

Create or update:

* README
* Architecture overview
* Local setup guide
* Environment-variable reference
* Database migration guide
* Routing-provider integration guide
* Regulatory-rule update guide
* HOS calculation documentation
* Calculation examples
* Testing guide
* Deployment guide
* Backup and restore guide
* Known limitations
* Safety and legal disclaimer

The HOS documentation must explain how each duty event affects:

* Driving time
* Shift time
* Cycle time
* Break qualification
* Sleeper qualification

## 24. Regulatory Update Strategy

Do not treat regulatory data as timeless.

Create:

* Rule-set versioning
* Effective dates
* Source attribution
* Last-verified timestamps
* Administrative rule review
* Ability to deactivate obsolete rules
* Change history
* Tests tied to regulatory versions

The interface must show:

“Regulatory data last verified: [date]. Confirm current restrictions with official authorities when required.”

Do not scrape random trucking blogs as legal authority.

Prefer:

* Federal regulations
* FMCSA
* FHWA
* State departments of transportation
* State legislatures
* State police or commercial-vehicle enforcement agencies
* Municipal ordinances
* Official permit and route maps
* Contracted commercial-routing data

Secondary sources may assist discovery but must not become the authoritative compliance record.

## 25. Security and Privacy

Implement:

* Authentication
* Authorization
* Input validation
* Rate limiting
* Secure secret handling
* No API keys in client bundles
* No secrets committed to source control
* Audit logging for administrative regulatory changes
* Protection against SQL injection
* Protection against cross-site scripting
* Protection against insecure direct-object access
* Safe export generation
* Account-level data isolation

Driver location, trip history, and HOS information are sensitive operational data.

Do not expose them publicly.

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
