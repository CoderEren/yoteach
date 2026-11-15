# Cycle 4 — saved content and live-response replay

| Priority | Finding | Evidence / cause | Outcome |
|---|---|---|---|
| P1 | Some real model sketch text disappears. | `before-labels.png`; recorded tool responses use `label` on text elements, while the schema requires `text`. Invalid elements were dropped. | Accept a string `label` only as a fallback when `text` is absent. Explicit text still wins; invalid values remain rejected. Unit regression and replay of all 12 recorded responses pass. |
| P2 | Long Saved material titles push the Unsave action outside its dialog. | `before.png`; the grid's automatic minimum size and non-wrapping button labels overflow. | Use a zero minimum grid track and wrapping labels; preserve icons/actions. `after.png` shows the full action. E2e checks button bounds, overflow, and restart persistence. |
| P1 | Changing Theme or Offer help resets the selected talk key to Control. | `settings-regression-unit.txt` and `settings-regression-e2e.txt`; Zod applied the stored-data default during a partial update. | Remove the default from the command field, retain it for migration; unit and restart tests preserve F8. No stored-data schema changes. |
| P1, open | Model-authored coordinates can overlap or clip labels; generated teaching content is not consistently correct. | `../live/sketch-*.png`: chemistry and literature clip text; literature has overlapping labels; geography focus/fault labels overlap; language repeats “The dog” for its plural example. | Schema fallback repairs missing labels but does not make arbitrary model geometry or content reliable. Requires a separate layout/content-validation design; automatically moving labels can misassociate them with the diagram. Recorded examples retained, not rewritten to make the model look better. |

The Saved material proposal was recorded in [Figma Cycle 4](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm?node-id=11-2) before the CSS change. Its shipped screenshot is on the same page.

Initial overflow regression was insufficient: `regression-before.txt` passed despite visible clipping. It has been strengthened to require every button's whole bounding box to remain within the dialog. This is not reported as a failing-before test. The first subject replay run failed because its test selector also matched the Close icon's SVG; `e2e-first-attempt.txt` preserves that harness failure. Selecting the labeled drawing SVG fixes the harness without changing product assertions.

Verification: 57 unit tests, TypeScript, clean build, and full Electron suite (10 pass; packaged-only test skipped because no bundle exists). Live fal image and video checks succeeded, including labels, Close, and saved restart. All 12 real hosted sketch payloads were rendered by the fixture provider and visually reviewed together; the rendering test is not an assertion of factual correctness or non-overlap.

No data schema change. The user's pre-existing Yoyo redesign is preserved separately and excluded from sprint commits.
