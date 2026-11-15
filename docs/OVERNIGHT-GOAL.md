Goal: by morning, Yoteach has been tested end to end, improved in at least three full find → fix → verify cycles with screenshot evidence, and has a Figma file that documents its design and the redesign work, ready for the Figma "Best-Designed AI Product" track. Done means `docs/overnight/REPORT.md` exists and every item in "Definition of done" at the bottom is true.

# Context

You are working on **Yoteach**, a macOS Electron app (React, TypeScript, Vite, zod). A floating violet mascot, **Yoyo**, is a voice tutor:
- **Voice:** an ElevenLabs Conversational AI agent; the hosted LLM is Claude Sonnet 5.5.
- **Seeing the screen:** Claude vision. The screen is captured with on-device OCR (native helper `native/capture-screen.swift`).
- **Teaching on screen:** Yoyo draws on the user's own screen on a click-through overlay: hand-drawn marks pinned to exact words, sketches, diagrams and animated scenes.
- **Images and clips:** fal makes these (`fal-ai/flux/schnell` for images, LTX for video).

There are two modes only:
1. **Chats.** Hold the talk key over any app, ask, and Yoyo answers and draws on that screen. Chats are filed and named by topic.
2. **Lectures.** Upload a PDF; Yoyo walks through it slide by slide in the app, skips filler slides and draws on the slides. Each walkthrough can be replayed later.

Other features:
- Circling or pointing with the cursor while holding the talk key.
- Proactive "Stuck on this one?" help, using on-device text recognition only.
- Saved explanations.
- Settings.

The built-in glucose lesson and practice questions were removed on purpose. Do not bring them back.

- Repo: `~/Desktop/YoTeach` (GitHub `CoderEren/yoteach`). Start from branch `stage-3-visual-learning` (latest commit `d74a4c7`).
- Read first: `docs/STAGE-3-HANDOFF.md` (chunks 1–12; its "Remaining" and "Resume instructions" sections are out of date: lessons and practice are gone), `docs/YOYO-AGENT-PROMPT.md`, `docs/agent-tools/*.json`, `PRODUCT.md`.
- Key code:
  - `electron/tutor.ts`: the tutor service, its tools and grounding.
  - `electron/tutor-ipc.ts`: capture, holds and proactive help.
  - `electron/desktop.ts`: the overlay, the talk key, cursor ink and Yoyo's flying.
  - `src/components/DesktopOverlay.tsx`: drawings, sketches, the cursor-ink canvas and the "Made by Yoyo" card.
  - `src/tutor.tsx`: the voice client and the hold flow.
  - `shared/drawing.ts`, `shared/grounding.ts`, `shared/gesture.ts`, `shared/stuck.ts`.
  - `src/drawing/hand.ts`: the hand-drawn ink, adapted from HyperFrames.
  - `src/styles.css`.

# Hard rules (do not break these)

1. **Branch.** Create `overnight-polish` from `stage-3-visual-learning`, then commit and push there after each verified cycle. Never merge, never force-push, and never touch `main` or `stage-3-visual-learning`.
2. **Where to work.** Work in `~/Desktop/YoTeach` itself, not a worktree. Screen Recording permission and the native helper are set up for this folder, and `.env` lives here. `.env` is git-ignored. Never print, log, commit or paste its values.
3. **The user's data.** Never touch `~/Library/Application Support/yoteach`. Every app launch uses an isolated `YOTEACH_DATA_DIR` in a temp folder, like `tests/*.e2e.ts` does. Close every app you launch, and leave no Electron processes running.
4. **Keep the Mac awake.** Run `caffeinate -dimsu` in the background for the whole run so the screen doesn't sleep or lock. Screen capture fails on a locked screen.
5. **Spending caps for the night.** Count every paid call in `docs/overnight/spend.md`:
   - fal: at most 40 images and 4 videos.
   - Anthropic: unit and e2e tests use fixtures; stay under about 400 live calls.
   - ElevenLabs: at most 80 agent conversations. Text-only websocket checks count, and are preferred over voice.
   Stop using a service when it hits its cap.
6. **The hosted agent.** Change it only through `node scripts/sync-visual-agent.mjs`, which backs up first and verifies. Never change the voice, the LLM, auth or overrides. Keep the four retired lesson and practice tools detached.
7. **Don't change product decisions:**
   - the Violet mascot design and its animations
   - the two-mode structure (Chats and Lectures)
   - having no Pause or End buttons
   - drawing on the user's own screen rather than in the app
   - the privacy model (the screen leaves the Mac only during a hold; proactive help is on-device only)

   Anything that would change these goes in the report as a proposal.
8. **Data.** Schema changes need a migration with an exact `.vN.backup`, like v8 has. Test the migration on a copy of a real-shaped workspace.
9. **Honesty.** Report results as they are. If a test fails, keep it failing and say so; never weaken a test to make it pass. Every "fixed" claim needs proof: a test, a screenshot, or a log line.

# How to test (tools that already exist)

- **Unit and build:** `npm test` (node:test with tsx), `npm run check`, `npm run format:check`. Always `rm -rf dist` before `npm run build` (iCloud makes "index 2.html" copies).
- **End-to-end:** `npx playwright test`. It launches Electron via `_electron` with fixture providers. `launch(dir, extraEnv)` and `fixtures(app, page)` in `tests/tutor.e2e.ts` give you a scripted ElevenLabs provider: `provider.tool(name, params)` makes Yoyo call a tool, and `provider.messages` holds what was sent to it. The screen capture is faked: set `globalThis.__captureWords` for its OCR words. Screenshots go to `.impeccable/review/`.
- **Live agent, no windows:**
  - `work/headless-q.mjs`: run as `Q="question" node work/headless-q.mjs`. It sends a text question to the real agent and prints what it says, its tool calls and its latency.
  - `work/headless-circle.mjs`: the circled-region variant.
  - `work/voice/live-voice.mjs`: synthetic speech.
- **Real screen, real models.** Open real content (a PDF in Preview, a Wikipedia page in Safari, a diagram image), then drive the real app:
  - Start it with `npm start` and a temp `YOTEACH_DATA_DIR`.
  - Ask questions with intents from Playwright (`window.yoteach.tutor.intent({type:'hold-start'})` / `hold-end`) or with typed chat text.
  - Take full-desktop screenshots with `screencapture -x file.png`, which includes the overlay.

  This is the only way to see whether marks land on the right words of a real screen.
- **Circling and pointing:**
  - In the service: call `service.setTrail({startedAt, points, aspect})` with a generated loop (see `tests/drawing.test.ts`).
  - In the overlay: send `overlay:trail` events (see the cursor-ink part of the on-screen e2e test).
- **Proactive help:** `YOTEACH_STUCK_TICK_MS=500 YOTEACH_STUCK_AFTER_MS=3000 YOTEACH_STUCK_IGNORE_IDLE=1`. Each check prints a `[stuck] …` line to the terminal.
- **Test PDFs:** `public/sample-lecture.pdf` and `work/test-deck.pdf`. Make more as needed, for example with a title slide, a references slide, dense text, equations, a figure-only slide, or a non-science subject.
- **Look at every screenshot yourself** by opening it with the Read tool. A test passing is not the same as looking right.

# Use cases to cover

Write these out as a table in `docs/overnight/USE-CASES.md` (id, scenario, steps, expected result, status), then test each one. At minimum:

- **Chats, across subjects.** Use at least 12 different questions: biology, chemistry, physics, maths (vectors, matrices, calculus), economics, history, computing, geography, language and literature. Also "show me a picture of …" and "make a short video of …". Check:
  - Yoyo answers quickly. Record the time to its first words.
  - It draws something that fits, not just a box chart.
  - The drawing is legible, sits in free space and doesn't cover the text being discussed.
  - Labels don't overlap.
  - It never says "This slide…", "Let me draw…" or "I can't see…".
- **Questions about what's on screen.** Real screens: a slide in Preview, a web article, code in an editor, a spreadsheet, an image-only figure. Check that every mark lands on the exact words or figure it names. Measure how far each mark is from the OCR word boxes, and check by eye in the screenshot. Check that the drawing clears when the topic changes.
- **Circling and pointing:**
  - circling a word
  - circling a sentence across two lines
  - circling a picture with no text
  - a sloppy, unclosed circle
  - pointing at a word
  - a stray wiggle, which should not count as a gesture

  "What is this?" must get a correct answer about the circled thing.
- **Lectures:**
  - uploading a PDF
  - "Run me through the lecture": the first sentence should come quickly
  - filler slides (title, references) are skipped
  - slide drawings are cleared when moving to a new slide
  - questions asked in the middle of a lecture
  - Continue
  - Replay walkthrough, with its narration and drawings
  - deleting a walkthrough
- **Chats list:** chats are filed and named by topic; a related follow-up stays in the same chat; a new subject starts a new chat; chats can be deleted.
- **Generated media:** an image and a clip both show the queue, the progress, the result, the "AI-generated" label, Close, and the failure message. They appear in Saved material after a restart, and the picture actually matches what was asked for (look at it).
- **Proactive help:** fires once per screen after the threshold, never while the Yoteach window is in front, never on a screen with no text, and works after Yoyo has drawn.
- **Settings:** theme light, dark and system; talk key choices; the Yoyo visibility switch; the proactive help switch. Each one persists.
- **Yoyo itself:**
  - every state: idle, listening, thinking, speaking, pointing, success
  - dragging it to all four screen edges, where it must never be clipped
  - flying to its drawings and back home
  - reduced motion
- **Failures:** missing keys, network down, fal out of credit, Screen Recording denied, silent hold, a very long hold, a hold cancelled while dragging. Each must give a clear message and never hang.
- **Accessibility:** keyboard navigation, focus rings, contrast, and screen reader labels on the app window and on the cards.

# The improvement loop (at least 3 full cycles; keep going while there is worthwhile work)

Each cycle:
1. **Audit.** Run the use cases above, plus a design critique of every screen and on-screen state. Use the `impeccable` and `design:design-critique` / `design:accessibility-review` skills if they are available. Save the screenshots in `docs/overnight/cycle-N/`.
2. **Triage** into `docs/overnight/cycle-N/FINDINGS.md`:
   - P0: broken or a dead end.
   - P1: wrong output, such as a mark in the wrong place, wrong text, a broken image, or speech that breaks the phrasing rules.
   - P2: a design or polish problem.
   - P3: a nice-to-have.

   Each finding gets evidence (a screenshot or log) and a likely cause.
3. **Fix** every P0 and P1, then the P2 and P3 items with the best value for the effort. For UI changes, design them in Figma first (see below), then implement. Add or extend a test for every bug fixed.
4. **Verify.** Run `npm test`, `npm run check`, the full `npx playwright test`, and live spot-checks of whatever changed. Take before and after screenshots and look at them. A fix that isn't verified isn't done.
5. **Commit and push** to `overnight-polish` with a clear message. If prompts or tools changed, sync the agent and re-run a headless check.
6. **Re-audit** from step 1. Watch for regressions.

Known issues to start with:
- **Drawing announcements.** Yoyo still sometimes opens a drawing with "Let's look at…" or "Let me show you…". `pre_tool_speech` is already off for the drawing tools; this is the model's own lead-in. Try prompt and tool-description changes and measure the effect over 10 or more headless runs.
- **Latency.** With a big sketch, Yoyo's first words come 4–6 s after the question. Find ways to get speech started sooner.
- **Dead styles.** Lesson and practice styles are still in `src/styles.css`.
- **Particles.** `flow` particles bunch together on short paths.
- **Not verified on a real Mac yet:**
  - the circling ink with a real cursor
  - the proactive-help fix
  - the circle and pointing detection thresholds on real hand-made gestures
- **Tool config.** `draw_annotation` and `highlight_screen_region` are not in the sync list, so their `pre_tool_speech` is still auto.
- **Stale docs.** `docs/STAGE-3-HANDOFF.md`'s "Remaining" and "Resume" sections are out of date; rewrite them.

# Figma: "Best-Designed AI Product" track

Track brief: "An AI product as well designed as it is smart, designed in Figma or built with Figma Make. Go for it on top of your main track: in your presentation, explain why you qualify and show evidence of how you used Figma." The prize is £960 plus merch.

Figma is connected in this session. First, check that you can read from and write to it, and record which Figma tools you have. If you can't create or edit files, say so in the report and do everything else.

Use Figma as the real design tool for this sprint, so the evidence is genuine:

1. **Create one Figma file, "Yoteach — Design".** Build it from the real app as it is now:
   - **Foundations:** colour variables matching `src/styles.css` (the Violet palette, the drawing tones ink, accent, muted, blue, green, pink, yellow, and dark mode); type (system UI, plus Caveat for the hand-drawn ink); spacing and radii.
   - **Components:**
     - Yoyo in every state
     - the notice bubble
     - the hand-drawn marks: circle, underline, highlight, arrow, label
     - the sketch frame with its caption bar
     - the diagram node and edge
     - the "Made by Yoyo" card
     - the cursor ink
     - the chat list item, the walkthrough row, the lecture stage controls and the settings rows
   - **Screens:** Chats, Lectures, the lecture stage, replay, Settings and Saved material, plus on-screen teaching over real apps: a slide, an article, a circled figure. Use real screenshots from your test runs, placed in frames and labelled.
2. **Design before building.** For every P2 or P3 UI change in the loop, make a "Before" frame and a "Proposed" frame (with redlines and notes) in a "Redesign — Cycle N" page, then implement and add an "After (shipped)" screenshot. This before → design → shipped trail is the main evidence for the track.
3. **Flows.** A prototype of the core flows:
   - hold the key → ask → Yoyo draws on the screen
   - circle something → ask "what is this?"
   - lecture → walkthrough → replay

   Use Figma prototyping, or Figma Make if it's available, for an interactive walkthrough of the on-screen teaching concept.
4. **Presentation page.** A "Figma track" page with 3–5 frames ready for the slides:
   - **Why Yoteach qualifies.** It teaches on your own screen instead of in a chat window. Its hand-drawn ink is pinned to the exact words, and it draws real animated scenes (moving particles, travelling pulses) instead of just diagrams. Privacy-first: proactive help is on-device only. Plus reduced motion, accessibility, and one calm mascot.
   - **The process timeline,** with evidence frames.
   - **The design system overview.**

   Keep it honest: the app was built in code first, and Figma was used to systematise and redesign it during this sprint. Say exactly that.
5. **Links.** Put the Figma file link in `docs/overnight/REPORT.md` and in `docs/FIGMA.md`, with a short note on how to present the Figma evidence.

# Definition of done

- At least 3 complete cycles, each with its findings, fixes, before and after screenshots, and a pushed commit on `overnight-polish`.
- `docs/overnight/USE-CASES.md` lists every use case with its final status: pass, fail or not testable, with the reason.
- All unit tests and the full e2e suite pass at the last commit. Any test that is skipped is explained.
- No P0 or P1 findings are left open, or each one left open is explained in the report with what blocked it.
- The Figma file exists with the foundations, components, screens, at least one redesign page per cycle, and the presentation page.
- `docs/overnight/REPORT.md` is written for the user to read first thing in the morning:
  - what changed, each with a one-line why
  - the before/after highlights, with links to the screenshots
  - measured latencies before and after
  - spending against the caps
  - what is still broken
  - proposals that need the user's decision
  - the Figma link
  - how to review: `git log stage-3-visual-learning..overnight-polish`
- No Electron processes left running and `caffeinate` stopped. The user's own data was never touched.
