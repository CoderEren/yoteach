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
- The existing hosted Yoyo agent now has the complete prompt in `docs/YOYO-AGENT-PROMPT.md` and eight tools (nine once chunk 3's sync runs). Original six IDs preserved; voice, Claude model, authentication and overrides verified unchanged. No new agent was created. `scripts/sync-visual-agent.mjs` is an explicit maintenance script, not run on app startup. Its backups are ignored under `work/agent-visual-*/`.

Evidence:
- 21 unit tests pass, including v3 byte-exact backup/preservation, lesson/session/source links, saved progress, invalid-step rejection and stale tool calls. Type checks, formatting and build pass.
- New real Electron fixture journeys cover keyboard, slider, play/pause/replay, reduced motion, saved restart, both visual tools, narration requests and held questions with zero external captures. The existing lecture journey now opens a visual lesson and returns to the same slide. All seven production desktop checks and all five Vite development checks passed. A final targeted regression also checks that closing a lesson during pending voice authentication does not trigger stale narration.
- **Live ElevenLabs verification passed:** a text request made the hosted agent call the actual open-lesson tool in Electron; step narration produced audio; a follow-up about consuming ATP was answered. No provider mock, personal microphone or screen was used in that live check. Local result `work/live-visual-result.json`; test script `work/live-visual-lesson.mjs`.
- Visual screenshot reviewed locally: `.impeccable/review/visual-lesson-transfer.png` (ignored). Application bundle rebuilt at `release/Yoteach.app` with the yo-yo Dock/menu icon.

## Chunk 3 — fal visual analogies

Implemented:
- `electron/fal.ts`: main-process fal queue client (`queue.fal.run` submit → status polling with backoff → result → download). `FAL_KEY` stays in main and is sent only to the queue host, never the CDN. Queue URLs from fal are accepted only on `queue.fal.run` under the request's own path. Media URLs must be HTTPS `fal.media`/`*.fal.media`; redirects refused; downloads streamed with byte limits (image 20 MB, video 80 MB) and timeouts (2 / 10 min); bytes are sniffed (JPEG/PNG/WebP/MP4/WebM) and must match the requested kind. Safety-checker blanks, content-policy errors, 401/402/404/422/429 and timeouts get specific messages. Cancel aborts locally and sends fal's cancel request.
- Models configurable: `FAL_IMAGE_MODEL` (default `fal-ai/flux/schnell`), `FAL_VIDEO_MODEL` (empty = Short clip hidden). Video uses `fal-ai/ltx-2.3/text-to-video/fast` (commercial use, Apache 2.0), sending 6 s, 1080p, 16:9, no audio (`videoInput`). **Live video verified (14 Nov):** clip visible after 37 s, 6.1 s, 1920×1080 MP4, 1.48 MB, saved with lesson step 3 (`work/live-fal-video.mjs`, `work/live-fal-video-result.json`, `work/live-fal-video.png`). The first attempt found that fal wants `duration` as a number; 422 errors now name the rejected setting.
- Prompts wrap a subject in a fixed "visual analogy, no text/labels/formulas" style. Each authored lesson step has an `analogy` subject (everyday objects, never chemistry depictions). UI labels every result "AI-generated visual analogy · not a scientific diagram", in a dashed frame distinct from the authored scene.
- Schema **5** (exact `.v4.backup`, plus v1–v3 as before) adds `media` records: kind, model, subject, prompt, UUID filename, type, size, dimensions, fal request ID, origin (student/tutor), session, lesson + step, lecture document/page. Files are written tmp → fsync → rename before the record; a failed save removes the file; orphan and `.tmp` files are cleaned on launch. Deleting a session deletes its media; deleting a PDF unlinks the source only.
- Narrow API `window.yoteach.media` (`generate`, `cancel`, `dismiss`, `read`, `remove`); bytes reach the renderer over IPC as blob URLs, so no CSP change. One generation at a time; runtime `generation` carries phase (queued/running/saving/done/failed/cancelled), queue position, error and latency.
- Surfaces: lesson step panel (generate / new / delete / retry / cancel), tutor workspace and lecture stage show tutor-started generations, Saved material lists media with a viewer showing origin, lesson step and lecture page.
- Agent tool `generate_illustration(subject, kind)` (`docs/agent-tools/generate_illustration.json`) returns once started; the renderer sends a contextual update when it is displayed or fails, stating the tutor has not seen it. Prompt updated in `docs/YOYO-AGENT-PROMPT.md`; `scripts/sync-visual-agent.mjs` now also syncs this tool. **The hosted agent has not been updated yet** — run the sync script only with the user's go-ahead.

Evidence:
- 27 unit tests (6 new in `tests/media.test.ts`: URL/byte validation, key never sent to CDN, foreign queue URLs ignored, oversize/HTML/NSFW/off-host rejection, failure messages, cancel → fal cancel request, atomic save with session/lesson/lecture links, restart, v4 → v5 backup, orphan cleanup). Type check, formatting and build pass.
- New Electron fixture journey (`fal visual analogy …` in `tests/tutor.e2e.ts`): queue status shown, real PNG decoded in the lesson, auth header only on queue requests, per-step media, 402 explained with Retry, Saved material reopens after restart. E2E launches now pin `FAL_KEY=test-only-fal` so the local `.env` key is never used by fixtures.
- **Live fal verification passed (14 Nov 2026):** one `fal-ai/flux/schnell` image through the real Electron main process from the lesson button — visible after 3.9 s, 1024×768 JPEG, 245 KB, saved with lesson step 3. Script `work/live-fal.mjs`, result `work/live-fal-result.json`, screenshot `work/live-fal.png` (all ignored).

## Chunk 4 — practice, feedback and review memory

Implemented:
- `shared/practice.ts`: six authored questions tied to lesson steps (four options, two written), model answers and rubrics, and a closed catalog of seven sourced misconceptions, each with a correction and review step. Wrong options name their misconception.
- Grading: an option (clicked, or typed/spoken verbatim) is graded deterministically. Written answers go to Claude (`Providers.grade`, structured output, catalog-only misconception IDs) against the model answer and rubric. A misconception is kept only if its evidence is an actual quote from the answer (`groundMisconceptions`). Tutor-recorded answers are checked against the student's last saved words: `transcript` keeps evidence, `reported` (a paraphrase) saves the verdict but never a misconception.
- Schema **6** (exact `.v5.backup`) adds `attempts`: question, answer, verdict, feedback, misconceptions with evidence, grader/model, origin, answer source, lesson, session and lecture page. Deleting a session deletes its attempts; deleting a PDF unlinks only the source. Students can delete any answer.
- Review suggestions (`reviewSuggestions`) come only from each question's latest answer; a later correct answer clears them. Elapsed time, playback and attendance are never used. Tutor context includes recent answers and review items so Yoyo can resume.
- UI: Practice inside the lesson (question tabs with latest status, options or a written box, feedback with possible misconception, evidence, correction, Review step N, model answer, grader note, Suggested review). Saved material has Practice & review. The tutor's lesson entry shows the review count. Answers in the app are sent to a live conversation as context.
- Agent tools `ask_practice_question` and `record_practice_attempt` (`docs/agent-tools/`), with prompt guidance. The sync script includes them; **not synced to the hosted agent yet.**

Evidence:
- 33 unit tests (6 new in `tests/practice.test.ts`).
- New Electron demo journey "Stage 3 demo: lecture → visual lesson → fal media → practice misconception → saved restart" (fixture providers, real UI). Screenshots in ignored `.impeccable/review/`.
- **Live Claude grading passed:** `claude-sonnet-4-6`, 4.9 s. The answer "…glycolysis nets four ATP overall" was graded partial, with `gross-as-net` grounded on the exact quote. Files `work/live-grade.ts` and `work/live-grade-result.json`.

## Chunk 5 — Yoyo teaches on the user's screen

Requested by the user on 14 Nov: drawing on the screen is the primary way to communicate. Outside the lecture, Yoyo should not bring the app window forward.

Implemented:
- The overlay window is now Yoyo's drawing surface over the display the question came from, or the display under the pointer. It is transparent and click-through (`setIgnoreMouseEvents(true, {forward:true})`); cards turn clicks on only while the pointer is over them (`overlay:interactive`). The overlay may use only a narrow channel list in `main.ts`. Capture already excludes every Yoteach window, so drawings never reach vision analysis.
- `draw_on_screen(marks, connections, clear)`: circle, underline, box, arrow, highlight or point on grounded regionIds from the latest `analyze_current_screen`, with short labels and labelled arrows between regions. Strokes animate in sequence as if hand-drawn, with a halo for contrast. Invented regionIds are rejected. Yoyo flies beside the first mark. In a lecture the same marks draw on the slide.
- `sketch_diagram(diagram)`: 2–7 nodes as a flow or cycle with labelled edges. `shared/drawing.ts` lays it out deterministically, so the model supplies no coordinates. It appears in free space and survives a new capture; grounded marks do not. `clear_screen()` clears both.
- Lessons, practice and tutor-started images open as cards on the screen (`lessonSurface: 'screen'`). They have Prev/Next, Explain, Practice, the phosphate slider, option answers and visual-analogy generation. Written answers are spoken. Cards take the side of the screen without marks; the sketch takes the other side. Lectures, and lessons opened from the app, keep the in-app views (`lessonSurface: 'app'`). Practice results from a card reach the conversation through a main-process `inform` intent.
- Held questions with a screen card open still capture the screen, and also send the card's lesson and practice context.
- Prompt and tools: AI tutor mode now says to teach on the screen and draw first. The hosted agent is **synced**: 14 tools, all checks true, backup `work/agent-visual-1794688923826`.

Evidence:
- 36 unit tests (`tests/drawing.test.ts`: layout bounds and determinism, grounded-only marks, add/replace/clear, sketch surviving a new capture, screen vs app surfaces, no app focus).
- Electron journey "Yoyo teaches on the screen…" replaces the old in-app agent-lesson test: capture → analyze → circle and label on the overlay → sketch → lesson card → Explain → Next → practice card with misconception → second capture with card context. The app window never gains focus. All 8 Electron journeys pass; packaged launch is skipped because no bundle exists on this Mac.
- **Live hosted-agent check passed** (text session, no microphone or capture). Asked to "draw a quick diagram on my screen", Yoyo called `sketch_diagram` (Glucose → Cleavage & Oxidation → 2 Pyruvate, labelled −2 ATP / +4 ATP). Asked for the phosphate transfer step, it opened the lesson card on the screen at step 3; the app window stayed on the tutor page. Files `work/live-screen.mjs`, `work/live-screen-result.json`, `work/live-screen-*.png`.
- Not verified live: drawing on a real captured screen (needs Screen Recording for this build and a spoken question), and real OS clicks on cards through the click-through layer. Playwright clicks bypass macOS hit-testing.

## Remaining

- Live spoken practice through the hosted agent (the tools are synced; not exercised with a microphone).
- A manual pass on a real Mac: hold the talk key over another app, ask about something visible, and confirm the drawing lands on it and the cards are clickable.

Do not claim Stage 3 complete until the user reviews it. Keep the lecture launch page at two controls and preserve the two-mode workspace. No wake phrase was implemented; always-listening support remains deferred.


## Resume instructions

1. Open `/Users/borakurtulus/Desktop/YoTeach`, inspect `git status`, stay on `stage-3-visual-learning`, and read this file plus PRODUCT.md. The original Stage 3 scope is in HANDOFF.md and `docs/ORIGINAL-PRODUCT-SPEC.md`, adapted to the two-mode workflow.
2. fal is done (chunk 3). With the user's go-ahead, run `node scripts/sync-visual-agent.mjs` to attach `generate_illustration` and the updated prompt to the existing agent, then verify a live tool call. Video stays off until the user picks `FAL_VIDEO_MODEL`.
3. Add practice answer/feedback evidence and review suggestions, not time-based mastery. Preserve v4 data through any subsequent schema changes. Complete the lecture → visual lesson → generated media → practice → saved restart demo.
4. Commit/push each tested chunk. No merge, and no claim of full Stage 3 completion until its acceptance criteria pass.

Useful commands: `npm test`, `npm run check`, `npm run format:check`, `npm run build`, `npx playwright test`, `YOTEACH_TEST_DEV=1 npx playwright test tests/tutor.e2e.ts`. Electron GUI tests require a macOS GUI context; in Codex this session used shell `require_escalated` successfully, without asking the user to run commands. Use isolated `YOTEACH_DATA_DIR`. Build packaging deliberately refuses to overwrite `release/Yoteach.app`; move the old bundle under ignored `work/` before `node scripts/package-mac.mjs`. Restart `npm run dev` after main/shared changes; HMR does not restart the Electron main process.
