# Mobile trip setup UI

Stage 18 introduces a dependency-free TypeScript custom element for entering a complete trip setup without editing JSON.

## Browser entry point

After the root TypeScript build, serve the repository and open `packages/ui/index.html`. The page loads `packages/ui/dist/index.js` and registers:

```html
<trip-route-planner></trip-route-planner>
```

Do not open the file directly with the `file:` protocol. Use a local HTTP server so ES modules load consistently.

## Events

The element emits bubbling custom events:

- `trip-draft-changed`: complete current draft after an edit
- `trip-draft-cleared`: saved work was removed
- `trip-calculation-requested`: validated draft, non-blocking legal-data warnings, and request reason (`manual` or `automatic`)

The Stage 18 component does not duplicate calculation, HOS, routing, compliance, ETA, or legal arithmetic. An application adapter must send the event payload through the accepted Stage 17 API and render provider or legal blockers returned by the server.

## Draft preservation

Unsaved work is stored locally under `trip-route-calc:trip-setup-draft:v1`. Malformed or structurally incomplete stored data is rejected and replaced by a fresh draft.

## Accessibility behavior

- Native labelled form controls
- Large touch targets
- Keyboard/button stop ordering in addition to drag ordering
- Locked-stop movement protection
- Focusable validation summary with live updates
- Text severity labels rather than color-only cues
- Single-column mobile layout
- Reduced-motion handling

## Scope boundary

This stage intentionally does not implement the map, route-result timeline, printing, or export presentation assigned to later sources. The browser page logs validated calculation requests until the host application adapter is connected to the Stage 17 API.
