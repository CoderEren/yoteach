# Yoteach overnight report — 15 November 2026

Five verified improvement cycles are committed and pushed on `overnight-polish`. The final code passes **59 unit tests, TypeScript, formatting, a clean build, and 11 Electron end-to-end tests**. One packaged-app test is skipped because no release bundle exists.

**The goal is not fully complete.** Real external-screen grounding could not be verified, and the Figma Screens page therefore lacks valid teaching captures over a real slide, article and circled figure. These are evidence gaps, not passes. Every requested use case is listed with its final status and reason in [USE-CASES.md](USE-CASES.md). The remaining P1 model issues are explained below, as allowed by the Definition of done.

## What changed

| Cycle / pushed commit | Change and why | Before → after | Findings / verification |
|---|---|---|---|
| 1 · `cd3b94d` | Keep reduced-motion sketches visible; distribute particles along short paths; respond to motion preference changes. Teaching must remain legible without animation. | [Before](cycle-1/before.png) → [after](cycle-1/after.png) | [Findings](cycle-1/FINDINGS.md), [tests](cycle-1/e2e.txt) |
| 2 · `f797b80` | Confirm walkthrough deletion, support Escape/Keep, and retain the source PDF. One misplaced click should not destroy saved narration. | [Before](cycle-2/before.png) → [after](cycle-2/after.png) | [Findings](cycle-2/FINDINGS.md), [tests](cycle-2/e2e.txt) |
| 3 · `c9dcfd2` | Explain missing setup; make Dismiss clear the actual runtime error; improve confirmation spacing and neutral help copy; remove dead lesson/practice styles and stale docs. Sync all eight silent drawing tools and verify hosted settings. | [Before](cycle-3/before.png) → [after](cycle-3/after.png) | [Findings](cycle-3/FINDINGS.md), [sync verification](cycle-3/agent-sync.txt) |
| 4 · `5887be9` | Wrap long Saved material labels; preserve real model text elements that use `label`; prevent unrelated settings updates resetting the talk key. | [Before](cycle-4/before.png) → [after](cycle-4/after.png); [missing-label evidence](cycle-4/before-labels.png) | [Findings](cycle-4/FINDINGS.md), [57 unit tests](cycle-4/unit.txt), [full e2e](cycle-4/e2e.txt) |
| 5 · `e002db8` | Add the persistent Show Yoyo switch; keep Tab/Shift+Tab inside dialogs and restore focus after Escape. Make visibility and keyboard navigation reliable. | [Before](cycle-5/before.png) → [after](cycle-5/after.png) | [Findings](cycle-5/FINDINGS.md), [59 unit tests](cycle-5/unit.txt), [11 e2e journeys](cycle-5/e2e.txt) |

Cycle 4's expanded settings check exposed a real regression: changing Offer help or Theme reset F8 to Control. The command schema reused a migration default. Removing that default from partial edits preserves the preference; the stored-data schema and migration defaults are unchanged. Both failing logs are retained beside the passing results.

Cycle 5 closes the previously reported visibility gap and adds synthetic tests for a two-line sentence and an imperfect open circle. Its keyboard test found and fixed both focus escape and missing return to the opener. A flaky audio test now waits for measured fixture PCM duration rather than wall-clock time; all release/privacy assertions are retained.

No new stored-data schema was introduced. Existing migration tests still verify exact backups and preserved data. No removed lesson or practice feature was restored; no Pause/End UI was added. The hosted agent's voice, model, authentication and overrides were verified unchanged, and all four retired tools remain detached. Its backup remains in ignored `work/agent-visual-1794709992268`.

## Measured live results

Twelve matched questions covered biology, chemistry, physics, vectors, matrices, calculus, economics, history, computing, geography, language and literature. [Before](live/before.json) and [after](live/after.json) retain the actual hosted speech and tool payloads. Client tool results were simulated during these websocket conversations; recorded sketch payloads were subsequently rendered in Electron and visually inspected.

| Measurement | Before | After | Interpretation |
|---|---:|---:|---|
| Median first response text | 3,939 ms | 4,042.5 ms | No latency improvement demonstrated. |
| First response text range | 2,806–5,470 ms | 2,489–5,269 ms | Small sample; network/model variation applies. |
| Drawing announcements | 9 / 12 | 4 / 12 | Improved in this matched sample, still fails the “never announces” requirement. |
| Real fal image | — | 4,658 ms | Aqueduct matches the requested subject; generated label, Close and saved restart verified. |
| Real fal video | — | 32,252 ms | Queued/running/done observed; six-second clip loaded; brass-pendulum frame at 2s reviewed; saved restart verified. Full motion quality was not evaluated. |

“First words” in the JSON means the first `agent_response` **text event**, not audible speech onset. No live audio latency claim is made. See [image](live/image.png), [video frame](live/video.png), [media log](live/media.json), and [restart](live/media-restart.png). The media harness's “Connecting…” status is its fixture-auth setup, not evidence of a failed paid voice connection.

## Remaining findings and blockers

| Priority | Finding | Evidence / blocker | Next action |
|---|---|---|---|
| P1 | Hosted agent still announces drawing. | Calculus, economics, language and literature in `after.json`. Prompt/tool changes were synced and measured; deterministic compliance is not established. Changing the hosted model is outside the product constraints. | Evaluate a separate speech/tool sequencing design on a larger matched sample before claiming a fix. |
| P1 | Model geometry and content remain unreliable in some sketches. | [Chemistry](live/sketch-chemistry.png) clips/overlaps labels; [geography](live/sketch-geography.png) overlaps focus/fault labels; [literature](live/sketch-literature.png) overlaps and clips text; [language](live/sketch-language.png) repeats “The dog” for a plural example. | Design a layout/content validation layer. Arbitrarily moving labels can attach them to the wrong concept; rendering success is insufficient. |
| P1 evidence blocker | Real external-screen targeting is unverified. | Native screen capture and Preview's integration view did not show the same foreground content. Even after the user placed the sample and replied ready, the guarded retry rejected the captured display locally. [Safe retry result](live/preview.json). | Use a verified shared native-display session and repeat slide/article/code/spreadsheet/figure tests with measured OCR distances. Do not present fixture screenshots as that evidence. |
| P2 | First-text latency remains around four seconds. | Matched measurements above. | Consider a separately evaluated speech-first sequencing approach; preserve the current voice/model unless explicitly approved. |

No known P0 remains. Physical hand-made gesture thresholds, actual Screen Recording denial, native proactive help after drawing, full VoiceOver traversal and live audio timing remain unverified; the matrix distinguishes these from fixture coverage. Tests for settings choices/persistence, four-corner bounds, flight/return, reduced motion, missing configuration, failed startup, no-credit errors, silence detection and bounded audio pass within their stated scope.

### Screen-capture incident

The user approved sending the sample lecture screen to the app's configured Anthropic service. Preview's integration screenshot showed that sample, but the native capture unexpectedly contained the Codex desktop. The harness sent it in two requests (inventory and analysis) before the mismatch was discovered. This was outside the intended sample-only capture. The user was informed immediately; further uploads stopped. The unexpected image and OCR were removed from local deliverable evidence and were never committed or uploaded to Figma. There is no claim that the provider-side requests were deleted.

The retry harness now holds Anthropic requests until local OCR matches the sample and excludes Codex. After the user's second readiness signal, that check rejected the capture and **sent nothing further**. The final JSON contains only the rejection, not the unexpected screenshot or OCR. A [later local-only display check](live/display-check.json) still did not match the sample; its image and OCR were discarded, with no network request. This guard is for this opt-in sample test, not a shipped replacement for the product's capture/privacy design.

## Figma evidence

[Yoteach — Design](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm), owned by **Emre's Team (student)**.

The file has light/dark color variables, drawing tones, spacing/radii, typography references, reusable teaching/UI components, canonical Violet state variants, six app-screen captures plus fixture teaching states, five redesign pages, three linked prototype flows, and four presentation frames. Read/write access and exported compositions were checked. [FIGMA.md](../FIGMA.md) records the tools and presentation guidance.

Show the five **Redesign — Cycle N** pages in Before → Proposed → After order, then **Flows**, then **Figma track**. Say exactly: **the app was built in code first, and Figma was used to systematise and redesign it during this sprint.** Proposals are design specifications; screenshots are test evidence, not editable reconstructions. SF Pro loaded but rendered blank through the connector, so readable Figma evidence uses Inter while the app retains system UI typography. Teaching ink uses Caveat Bold.

The Screens page's real external slide/article/circled-figure evidence is **missing** because of the native capture blocker. Existing fixture screenshots are labeled accordingly. Do not claim the Figma track package is fully submission-ready until those captures are added. Screenshots include both the pre-existing local mascot variant and later canonical-mascot checks; the component library uses the original committed Violet design.

## Spending and workspace integrity

[Full ledger](spend.md): ElevenLabs **25/80 attempts** (24 completed text conversations); fal **3/40 image attempts** (one actual generation), **1/4 videos**; direct Anthropic **6/~400 reserved attempts**, of which **two requests actually ran**. No currency total is claimed without provider billing data. Tests otherwise use fixtures.

Every Electron launch used a temporary `YOTEACH_DATA_DIR`; the user's `~/Library/Application Support/yoteach` was not accessed. `.env` stayed ignored and its values were not printed or committed. Work stayed in the requested checkout on `overnight-polish`; neither `main` nor `stage-3-visual-learning` was modified.

The pre-existing local edits to `src/components/Yoyo.tsx` and untracked `src/components/Yoyo.css` are preserved and excluded from sprint commits. Final build/e2e validation temporarily used the committed original mascot and restored the user's source byte-for-byte in a `finally` block. The built output therefore reflects the tested canonical mascot; a future development build will incorporate the user's local edits.

Cleanup evidence is in [cleanup.txt](cleanup.txt). All test Electron processes were closed and the task's `caffeinate` process was stopped after the final checks.

## Definition of done audit

| Requirement | Result |
|---|---|
| At least three pushed complete cycles | Pass — five, with findings, fixes, screenshots and verification. |
| Every use case has status and reason | Pass — [matrix](USE-CASES.md), including explicit fails and not-testable cases. |
| Unit and full e2e suite pass | Pass — 59 unit, 11 e2e; one documented package-only skip. Code tested matches the final code commit. |
| P0/P1 fixed or explained with blockers | Pass — remaining P1 issues and blockers are recorded above. |
| Figma foundations/components/screens/redesign/presentation | Partial — file and required pages exist, but real external-app teaching captures are missing. |
| Morning report | Pass — this report includes changes, evidence, latency, spend, issues, proposals and review instructions. |
| Process cleanup and isolated data | Pass — see cleanup log; no user workspace data was used. |

## Review

```sh
git log stage-3-visual-learning..overnight-polish
git diff stage-3-visual-learning..overnight-polish --stat
```

Start with the cycle findings and before/after links, then the live model failures and capture incident. The user decisions are whether to pursue a deterministic sketch-layout/content layer, and how to sequence speech before complex drawing. The original Violet design, two-mode structure, no Pause/End UI and on-device proactive privacy model remain unchanged.
