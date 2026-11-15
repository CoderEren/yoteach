# Cycle 2 — protect saved walkthroughs

| Priority | Finding | Cause and evidence | Fix |
|---|---|---|---|
| P1 | A single trash click irreversibly removes a walkthrough. | Lectures called deleteChat directly; regression-before.txt fails because confirmation is absent. before.png shows the row. | Use the existing accessible modal; describe lost narration/drawings and retained PDF; Keep, Escape and explicit Delete. Disable duplicate submissions. |

Designed in [Cycle 2 Figma page](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm?node-id=2-5) before implementation. after.png shows the shipped modal.

Regression covers Escape, Keep, confirmed delete, and retention of the original PDF. All fixture data lives in a temporary directory. The full suite also rechecks lecture replay, saved restart, media, holds, proactive help and the cycle-1 motion fix. Results: unit.txt, check.txt, build.txt and e2e.txt. No schema changes.
