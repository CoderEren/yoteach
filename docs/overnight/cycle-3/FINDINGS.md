# Cycle 3 — clear recovery and silent drawing tools

| Priority | Finding | Evidence and cause | Resolution |
|---|---|---|---|
| P1 | Missing configuration leaves lecture start disabled with no explanation. | before.png; failing setup regression | Accessible setup status and recovery instructions beside the two existing controls; PDFs remain readable. |
| P2 | Dismiss only clears local error; runtime error reappears. | regression-before.txt; two error sources | Validated dismiss-error intent clears the shared runtime error; next failure can appear normally. |
| P2 | Confirmation text touches modal edges. | Cycle 2 after.png | 24px content/action insets and wrapping actions. |
| P2 | Proactive help copy judges how long study should take. | src/App.tsx prior text | Describe the actual trigger without inferring confusion. |
| P2 | Retired lesson/practice CSS and handoff instructions remain. | detector.json and historical handoff | Remove dead selectors; document current two-mode product and v8 state. |
| P1 | Two annotation tools never receive silent pre-tool configuration. | sync list omitted draw_annotation/highlight_screen_region | Include both and verify every managed tool config after sync; regression checks silent-tool coverage and retired-tool exclusion. |
| P1, residual | Drawing announcements despite prompt. | 12 matched questions before/after | Changed prompt/tool description and synced with full backup/verification. Announcements fell from 9/12 to 4/12; not eliminated. Hosted-model variability remains; no claim of a full fix. |
| P2, residual | Time to first response remains around four seconds. | before.json / after.json | Compact first-scene guidance did not improve median text latency: 3,939ms → 4,042.5ms. Speech streaming is not established by these text-only measurements. |

Design preceded implementation: [Cycle 3](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm?node-id=2-6). Unit/check/build/full Electron suite and formatting results are adjacent. Agent sync reports unchanged voice, model, auth and overrides; four retired tools remain detached. No schema change.

Live checks use simulated client-tool results, not a rendered screen, and no fal calls. They establish speech wording and tool selection only. Do not infer visual legibility or answer correctness solely from tool selection.
