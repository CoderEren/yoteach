# Independent design assessment A

Date: 15 November 2026. Method: isolated design review, completed without detector findings. Target: `src/App.tsx` and its current Chats/Lectures surfaces. Evidence: PRODUCT.md; App, Chats, Lectures, LectureStage, LectureReplay, Modal, HoldButton, and styles source; eight existing screenshots in `.impeccable/review` (ai-tutor, lecture-library, settings, lecture-fullscreen, lecture-replay, practice-feedback, made-by-yoyo, on-screen-teaching). No code or mascot edits, Electron launches, paid calls, or live interactions. Screenshots establish visual composition, not current runtime correctness; accessibility behavior is source-inspected, not screen-reader tested. Practice screenshot may represent a legacy surface rather than the current two-mode route.

## Design specificity and impression

The product feels authored when teaching: the visible slides, grounded handwritten annotations, restrained iris highlight and companion create a coherent learning identity. The general workspace is more interchangeable: a familiar three-column messenger structure dominates an empty first visit, and the character's presence is small relative to the unused canvas. Keep the approved glass system and Yoyo. The biggest opportunity is to make readiness and the next useful action as clear as the teaching itself.

## Heuristic scores

Scores are quality, from 0 (poor) to 4 (excellent).

| Heuristic | Score | Evidence |
|---|---:|---|
| Visibility of system status | 2 | Listening/thinking and import progress exist; disabled lecture start does not explain missing requirements. |
| Match with real world | 3 | Chats, slides and walkthroughs are natural; environment-variable setup language is not. |
| User control and freedom | 2 | Native dialog dismissal and close controls work in source; walkthrough deletion has no confirmation; lecture stage lacks pause. |
| Consistency and standards | 3 | Cohesive tokens and labeled navigation; chat and walkthrough deletion behave differently. |
| Error prevention | 2 | Invalid starts are disabled; saved walkthrough deletion can happen in one click. |
| Recognition rather than recall | 3 | Persistent navigation, visible talk key and history; setup requires leaving the product and remembering instructions. |
| Flexibility and efficiency | 3 | Global talk key, typed questions, keyboard hold and replay seeking; lecture navigation remains basic. |
| Aesthetic and minimalist design | 3 | Readable, calm surfaces; empty chat rail and duplicated practice navigation consume attention. |
| Error recovery | 2 | Errors are surfaced and typed drafts survive failed sends; runtime errors cannot reliably be dismissed by the visible Dismiss handler. |
| Help and documentation | 2 | Inline descriptions and privacy explanations exist; no task-focused setup/recovery destination. |
| **Total** | **25/40** | **Acceptable; improve readiness and control before broad release.** |

## Strengths

- The two primary destinations are plainly labeled and easy to scan. The full-screen lecture removes irrelevant navigation and gives the PDF the largest visual area.
- Strong text contrast, large headings, native dialog semantics, visible focus rules and reduced-motion CSS form a useful accessibility foundation. Do not infer full compliance without interaction testing.
- Saved practice feedback quotes the student's answer and identifies a possible misconception rather than labeling the student. Source/provenance and generated-illustration disclosures support trust.

## Priority issues

1. **P1 — Missing setup turns the core task into a dead end.** `Lectures.tsx:60–78` disables start for missing voice/vision configuration without saying why; `lecture-library.png` shows the disabled CTA after a PDF is selected. `Chats.tsx:217–221` reveals `.env` and provider variable names under an otherwise inviting composer. Put a plain-language readiness explanation next to the blocked action and provide an explicit setup/help destination; disclose technical configuration there. Keep any unavailable state honest. Suggested command: `/impeccable clarify`.
2. **P1 — A walkthrough can disappear in one click.** `Lectures.tsx:114–122` directly calls deleteChat; Chats already uses a named confirmation dialog. Students may lose their saved explanation while aiming for Continue. Reuse the confirmation pattern, state that the PDF is retained if true, and preserve the item if deletion fails. Suggested command: `/impeccable harden`.
3. **P2 — Live lecture controls omit a visible pause and speaking status.** `LectureStage.tsx` shows slide navigation, hold-to-speak and Close lecture, but no pause or live speaking/thinking indicator when the microphone is idle. The screenshot confirms the sparse footer. A student taking notes must infer how to interrupt or close the lecture. Expose the supported pause behavior with a clear resume path, and display a compact text status without covering the slide. Verify lifecycle semantics before implementing. Suggested command: `/impeccable clarify`.
4. **P2 — Dismiss does not clear the error being displayed.** `Chats.tsx:130–136` renders `error || r.error`, but its button clears only local `error`. When runtime error remains, the banner persists. Make dismissal track the displayed error, or provide a meaningful retry action. Suggested command: `/impeccable harden`.
5. **P2 — Help copy makes an unsupported judgment about learning pace.** `App.tsx:256` says “longer than it should take,” contradicting PRODUCT.md's rule not to equate time with understanding. Use neutral wording about an optional check-in after time on the same screen; retain the local-processing explanation. Suggested command: `/impeccable clarify`.

## Cognitive load and emotional journey

Core Chats/Lectures screens have low choice density, good grouping and clear hierarchy. Their principal checklist failure is working memory during setup: users must leave the app and translate configuration instructions. The empty chat list also adds a pane without a selectable item.

The practice screenshot has moderate-to-high extraneous load: six lesson steps, six question selectors, three answer choices, two Back to lesson controls, and a bottom toolbar coexist. Chunking, minimal choices, single focus and progressive disclosure fail there. More than four choices occur in both six-item selectors; the bottom toolbar has seven actions. If this surface remains reachable, hide lesson navigation during practice and retain one return action. The talk-key select has five options only when opened; that is manageable disclosure rather than a reason to remove supported keys.

The emotional peak is seeing the tutor explain directly on a slide or screen. The valley arrives before that: a friendly invitation followed by disabled controls and developer configuration. At the end, saved feedback gives concrete reassurance; instant deletion threatens that trust. Neutral check-in language would avoid implying that thoughtful reading is failure.

## Persona red flags and minor observations

- **Jordan, first-time student:** can find Chats but cannot understand why both typing and speaking are disabled, or why a selected lecture cannot start.
- **Sam, keyboard/screen-reader user:** native buttons/dialogs and hold-key handlers are positive. The active lecture exposes the PDF as an image labeled only by slide number, with no visible transcript in this component; inspect the accessible content path before claiming equal access.
- **Alex, returning student:** accidental walkthrough deletion has no recovery; lecture pause is not discoverable in the current stage.

Minor: the saved-media screenshot exposes a raw provider model identifier in the primary disclosure; keep the illustrative limitation visible and move technical provenance behind details. Replay's icon-only controls have ARIA labels but would benefit from hover titles. The large empty Chats rail is a useful candidate for a compact first-use state. No redesign of Yoyo is recommended.

Questions for parent synthesis: What is the smallest useful first action before providers are configured? Can a student pause, think, and resume without losing place? Should a practice question temporarily own the page instead of sharing it with lesson navigation?

Questions skipped in this delegated artifact: parent handles user-facing synthesis and the authorized implementation scope.
