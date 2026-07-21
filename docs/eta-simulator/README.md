# ETA Simulator, Speeds, and Time Zones

Stage 15 provides a pure, deterministic commercial-trip simulator in `packages/foundation/src/eta-simulator.ts`. It consumes verified route data, ordered stops, a validated HOS departure state, segment conditions, compliance actions, operational events, and explicit HOS availability actions. It returns three projections over one auditable event model:

- `EARLIEST_LEGAL`
- `EXPECTED`
- `CONSERVATIVE`

The simulator does not fetch live data and does not guess missing legal or operational evidence. Callers must supply sourced route, traffic, weather, location, and regulatory inputs.

## Chronology and time zones

The simulation advances in UTC whole minutes. Every timeline event records:

- UTC start and end instants;
- elapsed duration;
- local start and end rendering;
- explicit IANA time zones;
- HOS clocks before and after the event;
- route, segment, stop, operational-event, or compliance identifiers when applicable;
- an explanation of why the event exists.

A segment may start in one zone and end in another. Elapsed time remains the UTC difference, while local clock labels reflect each endpoint. Appointments are resolved in the stop location's IANA zone. DST gaps and repeated local times use the shared time-domain resolution contracts.

## Speed model

`EtaSpeedModel` defines carrier and planning limits. `calculateEtaSegmentSpeed` selects the lowest applicable cap from:

1. governed maximum speed;
2. preferred planning speed;
3. maximum average trip speed;
4. carrier maximum speed;
5. road-class planning speed;
6. provider expected speed, when supplied;
7. verified provider travel time converted to an average speed;
8. legal or provider speed limit;
9. grade speed cap;
10. urban speed cap.

The projection factor is then applied without exceeding the selected cap. Verified provider travel time is preferred. When verified provider time is unavailable, the labeled fallback average is included in the cap stack and the projection confidence is lowered. Traffic and weather durations are separate sourced adjustments.

This is deliberately not a model that assumes the governed maximum for an entire trip.

## Constraint processing

The simulator advances until the next constraint and then composes the appropriate domain engine:

- HOS driving, shift, cycle, and interruption clocks;
- ordered stop arrival, appointment wait, check-in, service, HOS hold, and departure;
- compliance blocks and required actions;
- fuel, inspection, border, maintenance, and other operational events;
- planning buffers kept distinct from legal duration.

A required 30-minute interruption or ten-hour rest may overlap qualifying entered stop time. Only any remaining legally sufficient duration is appended. An appointment never authorizes faster driving, an HOS extension, or removal of a required action.

## Projection behavior

The three projections share the same input and event semantics. They differ only where an input explicitly provides ranges or projection factors:

- earliest legal selects minimum service and adjustment durations;
- expected selects expected durations and the expected speed factor;
- conservative selects maximum durations and the conservative speed factor.

Each projection returns status, confidence, reasons, blocking reasons, speed decisions, stop results, a complete event timeline, final HOS clocks, and final local-time output.

## Blocking and confidence

The simulator blocks rather than inventing certainty when:

- the normalized commercial route is not usable;
- a segment is unverified or carries a blocking/manual-verification restriction;
- required segment conditions are absent;
- a required operational or compliance action cannot be placed;
- legal driving or on-duty availability cannot be established;
- required cycle, recap, restart, or sleeper evidence is not supplied.

Fallback provider timing and unavailable live adjustments lower confidence. Stage 16 owns the broader documented confidence and explanation model.

## Persistence and replay

Stage 15 uses the existing immutable trip-revision persistence model. The complete `EtaSimulationInput` is stored as the revision input snapshot. `etaSimulationSnapshot` stores the three projections and their timelines as the result snapshot. Replaying the persisted input must produce the same result snapshot.

No Stage 15 migration is required. Any changed route, stop order, service duration, HOS state, provider evidence, or override creates a later revision.

## Verification

The Stage 15 test matrix covers:

- Pacific to Mountain, Mountain to Central, and Central to Eastern crossings;
- spring-forward and fall-back DST behavior;
- destination-local appointments;
- a time-zone crossing adjacent to a qualifying rest;
- early and late appointments;
- five intermediate stops;
- stop insertion and reordering after a calculation;
- different service durations at each stop;
- 30-minute interruption overlap with qualifying stop service;
- ten-hour rest overlap with an overnight appointment wait;
- persisted deterministic replay of all three projections and the event timeline.

Run the permanent repository gate with:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm lint:source
pnpm typecheck:source
pnpm test:source
pnpm build:source
```
