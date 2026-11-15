# Cycle 1 — readable static teaching

Audit: isolated Impeccable assessments A and B, source inspection, baseline 54 unit tests and eight Electron journeys (packaged check skipped because no bundle existed). Native Electron needed execution outside the sandbox; the initial sandbox launch failures are environmental, not hidden passes.

| Priority | Finding and cause | Evidence | Resolution |
|---|---|---|---|
| P1 | Reduced-motion sketches disappear: GSAP `clearProps: all` clears the opacity set in the same operation. | before.png; failing flow regression | Separate cleanup from visible end-state assignment; retain final step and moved positions. |
| P1 | All static particles share path origin; excessive requested counts overlap on short paths. | failing regression: 1 unique position for 12 particles | Space visible particles by actual SVG path length; cap density; initialise positions before animation. |
| P2 | Flow ignores changes to OS reduced-motion preference after mounting. | source effect read preference only once | Subscribe and stop/restart tweens immediately; clean up listener. |

Figma design preceded implementation: [Cycle 1](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm?node-id=2-4). Before and Proposed frames specify static spacing and readable end states.

Verification: new Electron regression checks visible ink, distinct positions, bounded density, static positions and live preference changes. Full results in unit.txt, check.txt, build.txt and e2e.txt. Screenshot after.png is captured from the actual Electron overlay with fixture tool data; transparent desktop areas render black in the PNG viewer.

Other audit findings triaged for later cycles: walkthrough deletion confirmation, setup clarity, error dismissal. The suggestion to add Pause is rejected because it conflicts with the product decision. Historical lesson/practice screenshots are not current app evidence.
