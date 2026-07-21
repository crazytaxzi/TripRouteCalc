# Stage 18 Decision: Mobile Trip Setup UI Architecture

- Date: 2026-07-21
- Source: `docs/specification/18_MOBILE_TRIP_SETUP_UI.md`
- Status: accepted for Stage 18 implementation

## Context

The repository contains verified TypeScript domain, routing, compliance, persistence, and Fastify API packages, but no frontend package, styling system, form library, client state library, query library, component library, or accessibility pattern. The shared guardrails therefore permit the documented greenfield frontend defaults: React, Vite, a mobile-first Progressive Web App, Vitest, and Playwright.

Stage 17 exposes trip creation and mutation plus driver and equipment creation. Reusable profile selection and editing cannot be implemented honestly because the HTTP boundary does not expose the already-existing tenant-scoped persistence list and update operations.

## Decision

1. Add one workspace package named `@trip-route-calc/web` using React, Vite, TypeScript, and a manually registered service worker and web manifest.
2. Use native CSS custom properties and semantic HTML rather than adding a second styling framework or component system.
3. Use React reducer/context state and browser storage rather than introducing a separate state or query framework.
4. Keep the bearer token in memory and `sessionStorage` only. Do not compile credentials into the client bundle or persist them with trip drafts.
5. Persist unsaved non-secret planning drafts in versioned `localStorage`, restore them explicitly, and clear them only after the user requests it.
6. Import provider-neutral domain schemas and client-safe API contracts. The browser may assemble validated request inputs, but HOS, route, compliance, ETA, confidence, and legal arithmetic remain server-side or in accepted domain services.
7. Add narrow tenant-scoped API endpoints for listing and editing drivers, tractors, trailers, and loads. Reuse existing persistence methods; do not create a parallel profile store.
8. Implement stop drag reorder with pointer and keyboard-capable sortable behavior plus always-visible move buttons. Locked stops remain immovable.
9. Keep map and timeline presentation out of Stage 18. Calculation responses are summarized only enough to show submission state, structured blockers, and warnings; Source 19 owns map, detailed clocks, and timeline rendering.
10. Use controlled recalculation: explicit calculation is always available, and optional immediate recalculation is debounced, abortable, and never runs while required input is invalid.
11. Validate component behavior with Vitest and Testing Library and validate the complete mobile workflow with Playwright at mobile and desktop viewport sizes.

## Security and privacy boundary

- No API key, bearer credential, database identifier, provider credential, or secret is committed or built into static assets.
- Public IDs remain typed encrypted API values.
- Draft storage excludes the bearer token and API error internals that may contain sensitive details.
- HTML is rendered through React text nodes; no untrusted HTML injection is used.
- Account and object isolation remain authoritative in the API and persistence layers.

## Accessibility boundary

- WCAG 2.2 AA is the practical target.
- Every field has a programmatic label and associated error message.
- Touch targets are at least 44 CSS pixels where practical.
- Stop order is represented in DOM order and announced after movement.
- Reorder controls work without drag.
- Severity is communicated with text and icons, never color alone.
- Focus moves to newly inserted stops and to the first invalid field on failed submission.
- Reduced-motion preferences disable nonessential transitions.

## Known limitations preserved

- B-002 still blocks live commercial-route verification.
- B-003 still blocks production legal-route evaluation.
- Stage 20 still owns complete login, session, token rotation, revocation, privacy review, and distributed rate limiting.
- Source 19 owns map, timeline, and detailed result presentation.
- Test routing and regulatory fixtures are not production evidence.