# Initial Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| HOS arithmetic is coupled to UI or persistence | Legal calculations become difficult to verify | Keep pure, integer-duration domain logic with exhaustive tests |
| Consumer navigation is treated as a CMV route | Unsafe or illegal route recommendations | Require a commercial routing provider and block legal claims when unavailable |
| Regulations are hardcoded | Rules become stale and unauditable | Use versioned, effective-dated, sourced regulatory data |
| Missing dimensions or axle information is silently ignored | Invalid route or KPRA conclusions | Block affected decisions or visibly lower confidence with reasons |
| Floating-point hours introduce clock drift | Incorrect HOS timelines | Use integer duration precision for authoritative arithmetic |
| Local timestamps lose time-zone meaning | Incorrect appointments and ETA results | Store UTC timestamps and IANA location zones |
| Placeholder providers leak into production | Convincing but false results | Limit doubles to tests and prohibit production fallbacks |
| UI development begins before legal foundations | Attractive interface masks invalid behavior | Enforce ordered source stages and completion gates |
| Original trip results are overwritten | Loss of audit evidence | Preserve revisions, snapshots, rules, provider evidence, and calculation history |
| Scope expands into teams, Canada, exemptions, or ELD behavior too early | Core release never stabilizes | Keep first release limited to U.S. solo property-carrying operations |
