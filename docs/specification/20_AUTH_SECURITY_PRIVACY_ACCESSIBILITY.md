# 20. Authentication, Authorization, Privacy, Security, and Accessibility Review

> Use this source as the active assignment for one dedicated implementation chat.  
> Read `00_SHARED_GUARDRAILS.md`, the repository implementation ledger, and every prerequisite source listed below before changing code.  
> Inspect the real repository first. Existing code is authoritative over guessed names, paths, schemas, packages, or architecture.

## Prerequisites

- Core APIs and UI implemented
- Existing auth system identified and preserved

## Goal

Harden the complete application, prove account-level isolation, protect sensitive operational data, and close practical WCAG 2.2 AA gaps.

## Required work

1. Verify authentication and authorization on every page, API, export, revision, facility profile, driver, equipment record, and administrative regulatory action.
2. Add object-level tenant checks against insecure direct-object access.
3. Validate and sanitize input/output for SQL injection, XSS, unsafe files, logs, and exports.
4. Add rate limiting and abuse controls appropriate to geocoding, route calculation, auth, and exports.
5. Verify secure secret storage and that no provider keys enter client bundles, source control, logs, or exports.
6. Review session/cookie/token configuration according to the existing stack.
7. Audit administrative rule changes and warning acknowledgements.
8. Define retention and deletion behavior for sensitive driver location, trip history, and HOS data.
9. Add security tests for cross-account access, role checks, malformed input, export isolation, and secret leakage.
10. Complete an accessibility review:
    - keyboard navigation
    - focus order
    - labels and errors
    - screen-reader stop ordering
    - accessible map alternative
    - contrast
    - touch targets
    - non-color severity
    - reduced motion
11. Fix discovered issues without unrelated visual redesign.
12. Document residual risks and deployment security requirements.

## Exit gate

Automated and manual checks show tenant isolation, protected secrets, safe inputs/exports, and a usable keyboard/screen-reader workflow.

## Relevant master requirements

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

## 26. Accessibility

Meet WCAG 2.2 AA where practical.

Include:

* Full keyboard navigation
* Proper labels
* Screen-reader-friendly stop ordering
* Accessible map alternatives
* Text timeline matching map information
* Do not use color alone for warning severity
* Sufficient contrast
* Large mobile touch targets
* Clear error messages
* Reduced-motion support

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
