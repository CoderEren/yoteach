# Stage 3 — incremental checkpoint

Stage 3 was explicitly authorized in the 14 November 2026 chat, superseding the stop-at-Stage-2 instructions in the historical HANDOFF.md. Work on `stage-3-visual-learning`; commit and push completed chunks. Do not merge without authorization.

## Chunk 1 — voice recovery and macOS identity (`a4198ae`)

- Removed a runtime `instanceof WebSocketConnection` check that rejected real SDK connections when Vite prebundled a separate class copy. The adapter now checks the audio-listener capabilities it uses.
- Failed connection/microphone startup and sending errors cancel recording and reset listening. Main-process hold state is released on session end; a late release after failure is harmless. Pointer release is tracked synchronously so lost capture cannot cancel a successfully released question. Idle dragging preserves existing screen grounding.
- Replaced the menu-bar icon and Dock icon with the current yo-yo. The packaged app declares `Yoyo.icns`; development sets the Dock icon at runtime. Committed SVG, PNG and ICNS sources in `assets/icons`; regenerate on macOS with `npx electron scripts/render-icons.cjs`.
- Verification: 19 unit tests, type checking, formatting and production build pass. Three real Electron journeys pass against Vite (`YOTEACH_TEST_DEV=1 npx playwright test tests/tutor.e2e.ts`), including provider failure followed by retry. All five production desktop checks pass, including packaged launch. Provider fixtures use the actual SDK and isolated data, not personal screen/audio.

## Chunk 2 — authored visual lesson

Implemented:
- A six-step glucose-phosphorylation lesson with reusable typed lesson/scene components, a manipulable terminal-phosphate transfer, schematic enzyme/substrate/product scenes, and an ATP balance chart. Scientific references are in `shared/lessons.ts`; these are schematic symbols, not atom-level chemistry or kinetic simulation. Avoid the misconception that breaking a bond alone releases energy, and distinguish first phosphorylation from the committed step and full-pathway ATP payoff.
- Space/arrow keys, previous/next, timed play/pause, replay, reduced-motion support, step narration via the existing ElevenLabs SDK, held questions, Stop voice and return to the tutor/lecture. Playback pauses for listening/speaking. Narration is requested per step; timed visual playback is not continuous narrated playback.
- Schema **4**, with exact pre-migration backups for v1/v2/v3, preserves previous data and adds saved lessons with revision, step, original session and optional lecture document/page. Saved material reopens progress. Playback time never changes mastery or learning records.
- `open_visual_lesson` and `navigate_visual_lesson` are real validated client tools. Their results return authored step content. Opening clears stale screen grounding; returning to a lecture regenerates its actual slide grounding. Questions inside the lesson use authored context instead of external capture. There are still exactly two workspace modes, and the lecture launch page still has only its two controls.
- The existing hosted Yoyo agent now has the complete prompt in `docs/YOYO-AGENT-PROMPT.md` and eight tools. Original six IDs preserved; voice, Claude model, authentication and overrides verified unchanged. No new agent was created. `scripts/sync-visual-agent.mjs` is an explicit maintenance script, not run on app startup. Its backups are ignored under `work/agent-visual-*/`.

Evidence:
- 21 unit tests pass, including v3 byte-exact backup/preservation, lesson/session/source links, saved progress, invalid-step rejection and stale tool calls. Type checks, formatting and build pass.
- New real Electron fixture journeys cover keyboard, slider, play/pause/replay, reduced motion, saved restart, both visual tools, narration requests and held questions with zero external captures. The existing lecture journey now opens a visual lesson and returns to the same slide. All seven production desktop checks and all five Vite development checks passed. A final targeted regression also checks that closing a lesson during pending voice authentication does not trigger stale narration.
- **Live ElevenLabs verification passed:** a text request made the hosted agent call the actual open-lesson tool in Electron; step narration produced audio; a follow-up about consuming ATP was answered. No provider mock, personal microphone or screen was used in that live check. Local result `work/live-visual-result.json`; test script `work/live-visual-lesson.mjs`.
- Visual screenshot reviewed locally: `.impeccable/review/visual-lesson-transfer.png` (ignored). Application bundle rebuilt at `release/Yoteach.app` with the yo-yo Dock/menu icon.

## Remaining chunks (not implemented)

3. Real fal image/video integration (main-process credentials), generation status/errors, saved media, live verification.
4. Practice answers, evidence-backed feedback/misconception/review memory; coherent demo and final review.

Do not claim Stage 3 complete at an intermediate checkpoint. Keep the lecture launch page at two controls and preserve the two-mode workspace. No wake phrase was implemented; always-listening support remains deferred.


## Resume instructions

1. Open `/Users/borakurtulus/Desktop/YoTeach`, inspect `git status`, stay on `stage-3-visual-learning`, and read this file plus PRODUCT.md. The original Stage 3 scope is in HANDOFF.md and `docs/ORIGINAL-PRODUCT-SPEC.md`, adapted to the two-mode workflow.
2. Continue with fal integration. `FAL_KEY` is **not configured** as of this checkpoint. Ask the user to enter it locally when ready; never ask for the secret in chat. Implement queue/status/error/cancellation handling in main, validate returned media URLs, bound downloads, persist artifacts atomically with session/lecture/lesson associations, and expose a narrow typed API. Keep generated illustrations distinct from precise authored science. Do not claim live fal verification until a real call succeeds.
3. Add practice answer/feedback evidence and review suggestions, not time-based mastery. Preserve v4 data through any subsequent schema changes. Complete the lecture → visual lesson → generated media → practice → saved restart demo.
4. Commit/push each tested chunk. No merge, and no claim of full Stage 3 completion until its acceptance criteria pass.

Useful commands: `npm test`, `npm run check`, `npm run format:check`, `npm run build`, `npx playwright test`, `YOTEACH_TEST_DEV=1 npx playwright test tests/tutor.e2e.ts`. Electron GUI tests require a macOS GUI context; in Codex this session used shell `require_escalated` successfully, without asking the user to run commands. Use isolated `YOTEACH_DATA_DIR`. Build packaging deliberately refuses to overwrite `release/Yoteach.app`; move the old bundle under ignored `work/` before `node scripts/package-mac.mjs`. Restart `npm run dev` after main/shared changes; HMR does not restart the Electron main process.
