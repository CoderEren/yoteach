# Hold-to-talk revision — 14 November 2026

## Delivered behavior

- Bare companion: no caption, background card, drag grip, popup, expression picker or workspace button. Hold to record; release to send. A green halo means listening; a dashed halo indicates preparation/upload. Dragging cancels a recording and saves the new home position.
- Settings persist a choice of Control, Fn/Globe, Right Control, Right Option or F8. A native helper observes only the chosen key's state and emits down/up. It does not log text, inject keys or suppress the OS binding. Input Monitoring is required once.
- Each held screen question captures the display under the pointer with ScreenCaptureKit, excluding Yoteach's own windows. No window picker or repeated app consent. No continuous stream. A lecture uses its actual PDF page instead.
- Grounded tools display temporary click-through desktop highlights, arrows, circles, points or underlines. Yoyo moves beside a region, points left/right with a simple string, then returns to its manually saved home. Positions are display-relative and respect Retina/negative-origin geometry. A screenshot is a still, so marks do not track subsequent scrolling/window movement.
- Lecture setup contains upload and “Run me through the lecture”. Teaching opens actual slides full screen, with only slide navigation, hold-to-talk, Pause and End controls. Saved PDFs and previous notes/history remain intact.
- Nonactivating macOS panels follow full-screen Spaces. Background throttling is disabled for the audio-owning renderer so closing/covering the workspace does not slow released audio delivery. App Hide, lock, sleep, Pause, End and Quit still stop the session.

## Checks

- 19 unit tests passed: original persistence/migration/provider/cancellation/grounding coverage plus PCM resampling and duration bounds, display/letterbox geometry and old-settings migration.
- TypeScript, formatting and production build passed. Native Swift helpers compiled. Local Yoteach.app was rebuilt and ad-hoc signed without credentials.
- Four final Electron journeys use temporary data, synthetic microphone streams, the real ElevenLabs SDK, and fixture transports: minimal UI/import/persistence/restore; packaged launch; full-screen lecture plus all six tools and saved progress; held audio with zero upload before release, stopped tracks, drag cancellation, automatic expressions, hidden-workspace operation and a verified move away/return to the manually saved home.
- A separate native Cocoa fixture entered full screen in another process. The on-screen window inventory still contained this test instance's Yoyo window, with all-Spaces visibility enabled. No user document was opened for that check.
- A live Electron/ElevenLabs SDK check fed a locally synthesized “What is photosynthesis? Answer in one sentence.” through the actual hold recorder, released it through the API and received the full transcript, an appropriate answer and audio/speaking activity. It used isolated data and deliberately disabled screen capture. No physical microphone or personal screen content was used.
- The live check found that burst audio and frequent user_activity events could prevent recognition. Released audio now uses normal 25 ms PCM cadence without those events. Upload therefore takes approximately the question's recorded duration, followed by hosted turn detection. The first message is empty so the agent waits for the question; lectures explicitly trigger teaching.

## Agent configuration

The existing Yoyo agent was updated in place: complete replacement prompt in YOYO-AGENT-PROMPT.md, revised descriptions for analyze_current_screen/highlight_screen_region/draw_annotation, and an empty saved First message. The same six tool IDs, authentication, voice, Claude model and override settings were retained. No new agent or tool was created in this refinement.

## Remaining limits

- The current test launch lacks Input Monitoring permission, so physical global-key detection needs that one-time macOS grant. The native helper reports this explicitly in Settings; mascot holding works independently.
- ScreenCaptureKit capture/permission flow and a physical microphone were not exercised against personal desktop content. Native capture compiled and the main-process screen snapshot/annotation path was exercised with a fixture. macOS 14+ is required for this capture helper.
- “Yo teach” wake-word activation is deferred. Reliable background detection requires a separate always-listening engine and permission/CPU work; it is not an easy browser toggle.
- The hosted agent still owns speech recognition and turn-taking. Long pauses within one held recording may be segmented by the service. Capture and drawing are still-based, grounded shapes, not live tracking or freehand diagram generation.
- Local packaging is ad-hoc signed, not notarized. The existing large SDK bundle warning remains. Stage 3 is not started.
