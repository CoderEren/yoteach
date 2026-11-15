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

## Chunk 6 — speed, screen-first teaching, chats, lectures, polish

The user's review of 14 Nov: silent holds were slow; answers began with "I'm analyzing…" and long waits; drawings ignored what was on screen; diagrams overlapped; settings looked chaotic; there was no need for Pause/End; chats were all called "AI tutor"; and they wanted Lectures and Chats sections, a cleaner ring animation, and a simpler mascot.

- **Silent holds** (`hasSpeech` in `shared/hold-audio.ts`): needs about 250 ms clearly above the recording's own noise floor (threshold capped so steady speech from the first moment counts). Silent holds are never sent; Yoyo shows "I didn't hear anything".
- **Speed.** A question-free screen map (`Providers.inventory`, `TutorService.preAnalyze` and `screenMap`) starts as soon as the capture lands, while the student is still talking. On release the renderer waits up to 3.5 s for it and sends it as a contextual update before the audio. The agent answers and draws immediately, using `analyze_current_screen` only for extra detail. Deeper analysis now adds regions instead of replacing them, so map regionIds stay valid. `QUICK_VISION_MODEL` (set locally to `claude-haiku-5-5`) measured 3.6–5.3 s for the trimmed 8-region map, against 14–17 s on Sonnet 4.6 (`work/bench-map-result.json`). Deep analysis stays on `VISION_MODEL`.
- **Teaching on the screen.** The prompt now says to prefer the student's own material and draw step by step with `clear:false`. Yoyo flies from mark to mark (the tour in `desktop.ts`). The new `sketch_on_screen` draws freely on a 100×70 canvas: arrows, lines, curves, circles, boxes, dots, text and axes, with ink/accent/muted tones and dashed strokes, optionally beside a region. Flow-diagram edges that skip a column now arc above the row (fixes the overlapping vector diagram).
- **Chats (schema 7, exact `.v6.backup`).** `chats` are named by subject. `Providers.topic` (quick model) files each question; a new subject starts a new chat, and messages said meanwhile move with it. Earlier sessions migrate to one chat each, titled by their lecture or first question. A reconnect within 30 minutes continues the latest chat. Chats can be deleted.
- **Always on.** Typing connects on demand; idle conversations (4 min) close quietly; Pause, End and Stop voice are gone. The lecture keeps Close lecture.
- **Home** is now Chats (subject list plus conversation, composer, Hold to speak) and Lectures (upload, run, and a Walkthroughs list with Replay and Continue). The "Why invest ATP" card is gone; Yoyo and Saved material still open the lesson.
- **Lecture replay.** Messages record their slide (`page`) and lecture drawings are logged (`slideDrawings`). `LectureReplay` rebuilds the walkthrough slide by slide, with captions, Yoyo's drawings, play/pause, a scrubber and optional narration (system speech). Nothing is recorded as video.
- **Polish.** Settings is a structured panel (talk key, theme segmented control, privacy facts). The dashed halo and orbiting star are replaced by one ring drawn in Yoyo's own coordinates: a rotating arc while thinking, ripples while listening.
- **Mascot.** Three minimal directions are in `work/mascot/mascot-options.png` (A Duo, B Hub, C Loop). Waiting on the user's pick.
- Hosted agent synced (all checks true, backup `work/agent-visual-1794695728161`). **Live check passed:** a typed vector question connected on demand; Yoyo called `sketch_on_screen` 3.4 s later (A, B, then a dashed accent resultant), and the chat was named "Vector Addition" (`work/live-sketch-result.json`, `work/live-sketch.png`). That run caught `sketch_on_screen` missing from the client tool list; a guard test now checks every `docs/agent-tools` file is registered and validated.
- Tests: 45 unit tests (new `tests/chats.test.ts`; additions to drawing and hold-audio). 8 Electron journeys, including replay at the end of the Stage 3 demo. Packaged launch is skipped because no bundle exists.

## Chunk 7 — exact positions, faster turns, expressive Yoyo

From the user's 14 Nov review: lecture start did nothing; drawings missed their targets ("the root of all problems"); use HyperFrames for animation; draw unprompted; use pointing and celebration; still too slow; saved explanations were raw text with no unsave; Violet mascot chosen.

- **Lecture start.** With the tutor always on, a chat connection usually exists, and `start` silently returned. Starting a lecture now disconnects the chat first. Start errors (e.g. microphone permission) show on the Lectures page. Live: a lecture started 0.8 s after the click with a chat connected, and Yoyo taught slide 1.
- **Spatial grounding.** `native/capture-screen.swift` runs on-device Vision text recognition (about 0.55 s including capture) and returns line and word boxes (`textBoxes`, `words`). It also has a `--file` mode for tests. `shared/grounding.ts` `anchor()` snaps quoted evidence to the exact words: tolerant tokenisation, Greek lookalikes, hyphens, wraps of up to 3 lines with per-line `parts`, and repeats resolved by the model's estimate. The model receives a compact `screenTextLayout`. Labels use `labelSpot` (avoiding text, other labels and the drawn stroke, measured in the real font), and panels use `freeSpot`. Verified on a recreated slide (`work/grounding/marks.png`; fixture `tests/fixtures/slide-ocr.json`): with real Haiku map and Sonnet analysis calls, 13 of 14 quotes anchored at first, and the last after the hyphen fix.
- **HyperFrames.** `src/drawing/hand.ts` adapts the Apache-2.0 handwritten family (wobbled ellipse, bowed lines, hand box, underline, arrow, pen-velocity ease, boil) with GSAP and Caveat labels (`THIRD_PARTY_NOTICES.md`). Marks, connections, sketches and diagrams all draw on like handwriting.
- **Speed.** The screen is captured and read when the key goes down (`earlyCapture`), not after the voice connection opens. Held audio streams live (`HoldAudio.streamLive`) with `user_activity` every 0.7 s, so on release only the tail and 0.7 s of silence are sent, instead of the whole question at real-time speed.
- **Expressive Yoyo.** New `celebrate` tool (happy face, bounce, sparkle burst; overrides "sending"). Ink starts after Yoyo flies to the first mark. Yoyo also flies beside new sketches, diagrams and screen cards (`overlay:focus`, `desktop.pointAt`). The prompt now has explicit rules for choosing marks, diagram, sketch, image or talk, without waiting to be asked. Live: "How does adding two vectors work?" led to `sketch_on_screen` 3.9 s later, unprompted, and "Yes, that makes sense" led to `celebrate`.
- **Saved explanations.** Voice tags such as `[happy]` are stripped from stored replies (`cleanSpeech`). Saved material shows formatted cards with title (the chat title), date, lecture and slide source, paragraphs and Unsave. The chat Save button toggles.
- **Violet Yoyo.** Single-hue violet glass with a simplified face (two capsule eyes and a small smile); Dock, menu-bar and accent colour updated.
- Agent synced (backup `work/agent-visual-1794698089677`). Tests: 47 unit tests and 8 Electron journeys (the hold test now asserts streaming only while held).

## Chunk 8 — lost questions, slide latency and weighting, animated scenes

From the user's 15 Nov report: questions (matrix in a coordinate system, cholesterol, "Can you hear me?") got no response and did not appear in chats; slides took ages; title and lecturer slides got equal weight; visuals too limited.

- **Root cause of lost questions:** the `user_activity` messages sent every 0.7 s while held postponed the server's end-of-turn check. After release only 0.7 s of silence was sent, then nothing, so on longer questions the turn never closed: no transcript, no reply, stuck "thinking". Reproduced with a live harness (`work/voice/live-voice.mjs`: synthesized speech through the real hold path and the real agent, with a recreated slide in place of the screen). Fix: no `user_activity`. After release, real-time silence continues until the server reports the transcript (`HoldAudio.heardUser`), between 0.8 and 3 s. Live after the fix, 4 of 4 turns answered: transcript 0.5–0.6 s and reply 1.6–4.8 s after release. A 12 s watchdog shows "Sorry, I lost that one" and resets if nothing comes back.
- **Lectures.** Every slide is read ahead (`Providers.slidePrep`, fast model, current slide first, then the deck, two at a time) and cached (`TutorService.prepareSlide`, `slideBriefing`). Each slide gets a kind (teach / brief / skip), summary, key points, regions pinned to the slide's words, and `nextTeachingSlide`. `teachSlide` starts speaking at once from the slide text (with `guessSlideKind` if the read isn't ready) and sends the regions when they arrive. Live: first sentence 2.9–4.5 s after start or a slide change (previously ~11 s+). On a synthetic deck (`work/test-deck.pdf`: cover, agenda, two content slides, divider, thanks), filler got one line or none and the content slides got 54 and 70 words. Messages that continue onto the next slide take that slide's number.
- **Animated scenes.** `sketch_on_screen` now takes build `step`s with per-step `captions` (lower-third bar) and `moveTo` motion (GSAP), with a kinetic handwritten title: HyperFrames-style scenes in one frame. Parsing is forgiving (clamps coordinates, trims labels, drops unknown elements); vision region shapes fall back to highlight. Verified frames: `work/voice/scene-*.png` (a matrix acting on basis vectors).
- **Prompt:** never go silent (start talking, draw a simpler version, or say in one sentence what you can't do); animate with steps and motion; images and clips for real-world pictures and motion; lecture weighting.
- Fixed a scene restart on unrelated state updates, missing title spaces, dropped captions, and closing voice tags (`[/slow]`).
- iCloud Desktop sync created conflict copies in `dist/` ("index 2.html") during rapid rebuilds, which broke test launches. `rm -rf dist` before building resolves it; consider moving the repo out of the iCloud-synced Desktop.
- Agent synced (backup `work/agent-visual-1794700815830`). Tests: 49 unit tests (new `tests/slides.test.ts`) and 8 Electron journeys.

## Chunk 9 — clean screens, quote marks, natural speech, proactive help, smaller Yoyo

- **Clearing.** A slide change clears all drawings. A new question clears the previous drawing unless the topic check reports `buildsOnLast` (a follow-up on the last answer or drawing); small talk and new questions clear it. A drawing made for the new question is never cleared.
- **Promised drawings.** Live tool logs showed "I'll highlight…" followed by a diagram box, because slide regions weren't ready on the first slide. `draw_on_screen` marks and connections now accept `quote` (exact visible words), resolved on the spot against recognised words or PDF text runs (`wordsOf`). Unresolved targets are reported, not fatal. Live: quote marks landed from slide 1 (5 marks), then 6 on slide 2.
- **Natural speech.** The hosted agent ran Claude Sonnet 4.6 at temperature 0, which gave identical openings. The sync script now sets temperature 0.7 (`temperatureSet` verified). The prompt and the per-question note ban template openers and announcements, and prefer in-place annotation over pop-up boxes. Openings now vary, but Yoyo still sometimes announces a drawing ("I will draw…") and once promised highlights without drawing. **Switched on the user's request (15 Nov): the hosted agent now uses `claude-sonnet-5-5`** (`scripts/set-agent-llm.mjs`; backup `work/agent-llm-1794703298566`; prompt, tools, voice and auth unchanged). Temperature 0.7 is accepted. Headless check over the agent's websocket (`work/headless-agent.mjs`, no app windows): first reply in about 2.3 s; it annotated the on-screen pathway in place by quotes, sketched only the missing downstream steps (HMG-CoA → mevalonate → squalene → cholesterol), explained, and checked understanding. It still occasionally announces a drawing ("I'll mark the steps…").
- **Proactive help.** `shared/stuck.ts` `StuckWatch`: every 30 s, when the student is active (system idle under 45 s), not in a lecture or conversation turn and not in Yoteach, the screen under the pointer is captured and read on-device (nothing sent). If it stays the same longer than `stuckAfterMs` (45 s + 0.4 s per word, between 75 and 360 s), Yoyo shows "Stuck on this one? Hold <key> and ask me." once per screen. If a conversation is open, the agent also offers help in one sentence (`nudge`; no screen data sent). Settings has a switch; the default is on.
- **Smaller Yoyo:** 150×165 (was 200×220), one constant (`PET`).
- Tests: 52 unit tests and 8 Electron journeys. Live runs launch visible app copies (each with a Yoyo), so keep them short or seed test data with `mascotVisible: false`.

## Chunk 10 — cursor ink, live drawings, fal on request

- Cursor ink: while the talk key is held, `electron/desktop.ts` polls the cursor (16 ms) on that
  display and the overlay draws a fading violet trace (`CursorInk`, canvas). On release,
  `shared/gesture.ts` reads a loop (turns ≥ 1.6π and closes) as "circled" and travel-then-rest as
  "pointed"; the words inside or under it (on-device OCR) become a region. `TutorService.setTrail`
  ties the path to the screen captured for that hold; the screen map gains `pointer`
  `{kind, quote, regionId}` and the agent is told "this" means it. Key holds only (holding Yoyo uses
  the mouse); not in lectures. The path never leaves the Mac; only the circled words go with the map.
- Richer sketches: `shape` (filled closed outline), `ellipse`, `flow` (labelled particles looping
  along a path: ions, blood, electrons), `pulse` (travelling glow: action potential), `fill`,
  `width`, tones blue/green/pink/yellow, `size: large`. Prompt now makes drawing the real thing the
  default (worked neuron example); headless check: Sonnet 5.5 draws soma, axon, Na+ in, K+ out,
  pulse, three captioned steps.
- fal: `generate_illustration` is used whenever an image or video is asked for, never "could not
  find one"; mechanisms are drawn live and can get a clip too.
- `pre_tool_speech: off` on drawing tools. The model still says one short lead-in line before a
  large sketch (~5 s to generate); it always follows with the drawing.
- Fixes: Yoyo clipped on the right (container 150×165); a sketch title replaced mid-animation
  froze half-faded (`fromTo` with explicit end values); ink beading.

## Chunk 11 — circling pictures, drawing in every subject, proactive help fixes

- Circling or pointing now works on pictures and figures, not only words: the circled spot is
  cropped (`nativeImage`, 1.6× padding) and the quick model says what it shows
  (`Providers.describeSpot`, ~2.5 s). The trail streams to the service every ~400 ms during the
  hold, so this usually finishes before release; the screen map's `pointer.seen` carries it.
  Loop detection is more forgiving (≥1.3π turn, closes within half its size).
- Drawing guidance is subject-neutral (history maps, economics curves, networks, physics, maths,
  geography, language…); fal images for any subject. Checked headlessly: supply and demand,
  Hastings battlefield, how a webpage loads, circled receptors.
- Proactive help: idle time only counts as away after 5 minutes (staring at a hard slide is being
  stuck; no offer while idle over 3 minutes, without using it up); screens with fewer than 5
  recognised words (full-screen video, photos) never trigger. Test hooks
  `YOTEACH_STUCK_TICK_MS`, `YOTEACH_STUCK_AFTER_MS`, `YOTEACH_STUCK_IGNORE_IDLE`; new e2e proves
  the offer appears and no network request is made.

## Chunk 12 — built-in lesson and practice removed; proactive help unblocked

- Removed the authored glucose-phosphorylation lesson (chunk 2) and its practice and grading
  (chunk 4): `shared/lessons.ts`, `shared/practice.ts`, `VisualLesson`, `LessonScene`, `Practice`,
  their IPC, intents, runtime fields and the student-side "Generate visual analogy / Short clip"
  buttons. The app has chats and lecture walkthroughs only. Yoyo still makes fal images and clips on
  request (`generate_illustration`, "Made by Yoyo" card, Saved material).
- Data v8: drops `lessons` and `attempts` and media lesson fields, exact `.v7.backup`. Checked on a
  copy of the real workspace: chats, messages, PDFs, media and explanations all kept.
- Agent: `open_visual_lesson`, `navigate_visual_lesson`, `ask_practice_question`,
  `record_practice_attempt` detached by the sync (definitions kept in the account and backup);
  prompt no longer mentions them; quizzing happens in conversation.
- Proactive help never fired after Yoyo drew anything: `pointing` only cleared on a voice mode
  change, and counted as busy. Pointing now clears after 6 s and is not busy. With a
  `YOTEACH_STUCK_*` test hook set, each check logs its decision as `[stuck] …` in the terminal.

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
