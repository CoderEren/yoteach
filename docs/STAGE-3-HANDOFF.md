# Stage 3 — incremental checkpoint

Stage 3 was explicitly authorized in the 14 November 2026 chat, superseding the stop-at-Stage-2 instructions in the historical HANDOFF.md. Work on `stage-3-visual-learning`; commit and push completed chunks. Do not merge without authorization.

## Chunk 1 — voice recovery and macOS identity

- Removed a runtime `instanceof WebSocketConnection` check that rejected real SDK connections when Vite prebundled a separate class copy. The adapter now checks the audio-listener capabilities it uses.
- Failed connection/microphone startup and sending errors cancel recording and reset listening. Main-process hold state is released on session end; a late release after failure is harmless. Pointer release is tracked synchronously so lost capture cannot cancel a successfully released question. Idle dragging preserves existing screen grounding.
- Replaced the menu-bar icon and Dock icon with the current yo-yo. The packaged app declares `Yoyo.icns`; development sets the Dock icon at runtime. Committed SVG, PNG and ICNS sources in `assets/icons`; regenerate on macOS with `npx electron scripts/render-icons.cjs`.
- Verification: 19 unit tests, type checking, formatting and production build pass. Three real Electron journeys pass against Vite (`YOTEACH_TEST_DEV=1 npx playwright test tests/tutor.e2e.ts`), including provider failure followed by retry. Production suite includes packaged launch. Provider fixtures use the actual SDK and isolated data, not personal screen/audio.

## Planned next chunks

2. Deterministic interactive glucose-phosphorylation lesson, persistence/migration, step/play/replay controls and tutor integration.
3. Real fal image/video integration (main-process credentials), generation status/errors, saved media, live verification.
4. Practice answers, evidence-backed feedback/misconception/review memory; coherent demo and final review.

Do not claim Stage 3 complete at an intermediate checkpoint. Keep the lecture launch page at two controls and preserve the two-mode workspace. No wake phrase was implemented; always-listening support remains deferred.
