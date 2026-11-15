# Stage 2 design persistence review

Date: 2026-11-14. Scope: ordinary extension of the user-approved Stage 1 system, including the companion restore regression. Direction: `stage-2-brief.md`; product authorization: `../PRODUCT.md`.

**Persistence complete. No global visual-system changes required.** `../DESIGN.md` and `design.json` remain unchanged. Stage 2 continues The Quiet Study Desk through the incumbent palette, system font stack, glass surfaces, thin borders, compact controls, course rail and replaceable lavender/icy-blue Yoyo. No new palette, type family or global component language was introduced.

## Evidence checked

- System: `../DESIGN.md`, `design.json`, `stage-2-brief.md`, `../PRODUCT.md`.
- Source: root/theme tokens, existing and Stage 2 rules in `../src/styles.css`; study-session, companion, PDF-sharing, saved-explanation and navigation patterns in `../src/components/TutorWorkspace.tsx`, `Companion.tsx`, `PdfViewer.tsx`, `CourseWorkspace.tsx` and `../src/App.tsx`; companion restore handling in `../electron/main.ts`.
- Individually opened original-detail captures: `review/study-connected.png`, `review/study-connected-dark.png`, `review/study-connected-small.png` and `review/companion-connected.png`. These cover the light/dark shell, supported narrow desktop composition, source/conversation hierarchy, and connected companion treatment.
- Finish reviewer handoff: **SHIP**, five review sections passed, no material fixes, at UI/fixture evidence scope. Its broader capture set also includes disconnected study, saved explanations and expanded companion states.

## Extension decisions

The study surface reuses existing glass containers and button, navigation, field and text-action treatments. Its conversation and shared-source panels sit side by side on the standard desktop and stack at the local 1150px breakpoint. This is a surface-specific responsive decision; it does not replace the existing shell breakpoints or claim phone support.

Transcript text and saved explanations use the same system family and reading hierarchy. Shared-page annotations pair iris-family marks with numbered text/evidence keys. These marks belong to the source viewer and do not create a global semantic color or progress scale. Permission state remains expressed through text and icons as well as color. The session controls and Yoyo panel preserve the established compact hierarchy and shared topic context.

The native restore fix restores compact bounds, leaves fullscreen/maximized states and reapplies transparency. It does not require a visual identity change. Static captures alone do not prove native restoration or external capture behavior.

Stage 1 references in the incumbent system document describe that implementation snapshot. For authorized Stage 2 capability and connection-state behavior, use the Stage 2 brief, product record and setup documentation; expression previews remain explicitly separate from a connected session. No Stage 1 preview limitation is promoted into a permanent product prohibition.

## Drift and verification limits

Pre-existing font-size and radius advisories remain reported, not repaired or added to the normative token scale. Comparison with `HEAD:src/styles.css` confirms existing local sizes such as 8/9/11/13/14/17/18/21/24/25px and radii of 5/7/12px. Stage 2 local heading and annotation sizing likewise does not justify expanding the global scale. The pinned system typography is preserved as the approved native product direction.

The implementation handoff reports 13 unit tests and three Electron journeys, including native restore, SDK fixtures with six client tools and memory, and synthetic voice/worklet controls. Rotated PDF text geometry received a functional regression test after visual review; upright sample appearance and visual-system rules are unchanged. These are fixture and synthetic checks: live provider calls, physical microphone/audio quality and real external-window capture remain unverified without the required environment and credentials. `../README.md` and `../docs/STAGE-2-SETUP.md` retain the setup instructions and limits.
