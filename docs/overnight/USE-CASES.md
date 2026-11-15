# Overnight use-case results

Status describes the explicitly stated scope. **Pass** is not a claim of universal model correctness. **Fail** includes observed product/model defects. **Not testable** means this run lacks the named evidence; the reason is recorded. Fixture tests use isolated temporary workspaces and make no paid calls. Native Electron is real; most screen capture, speech and provider responses are fixtures.

## Chats across subjects

Each row: send the exact question to the real hosted agent before/after the prompt sync; record its first `agent_response` text; replay its unchanged tool payload through the real Electron overlay; visually inspect the PNG. Expected: subject-first speech, a relevant legible sketch, no drawing announcement. Times are text events, not first audible speech. All 12 tool payloads rendered; this alone does not pass the quality criterion. Free-space placement over a real external page remains unverified for every subject.

| ID | Scenario / exact question | First text before → after | Status | Evidence and reason |
|---|---|---|---|---|
| C01 | biology: Why does a neuron fire an action potential? | 3106 → 4319 ms | pass | [Sketch](live/sketch-biology.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C02 | chemistry: Why does a catalyst speed up a reaction? | 4470 → 4088 ms | fail | [Sketch](live/sketch-chemistry.png); Axis/product labels clip or overlap. |
| C03 | physics: How does a pendulum exchange energy? | 4269 → 3739 ms | pass | [Sketch](live/sketch-physics.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C04 | vectors: How do I add two vectors? | 2943 → 3281 ms | pass | [Sketch](live/sketch-vectors.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C05 | matrices: What does a rotation matrix do to a grid? | 3609 → 5025 ms | pass | [Sketch](live/sketch-matrices.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C06 | calculus: What does a derivative mean? | 2868 → 2489 ms | fail | [Sketch](live/sketch-calculus.png); Drawing announcement remains. |
| C07 | economics: Why does a supply shortage raise prices? | 3170 → 3970 ms | fail | [Sketch](live/sketch-economics.png); Drawing announcement remains. |
| C08 | history: How did Roman roads help trade? | 2806 → 5269 ms | pass | [Sketch](live/sketch-history.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C09 | computing: How do packets travel across a network? | 5470 → 4128 ms | pass | [Sketch](live/sketch-computing.png); Relevant scene and readable major labels in this sample; no forbidden lead-in detected. Small diagram labels still need broader evaluation. |
| C10 | geography: Why do tectonic plates cause earthquakes? | 4987 → 3997 ms | fail | [Sketch](live/sketch-geography.png); Focus/fault labels overlap. |
| C11 | language: How does the subject relate to the verb in a sentence? | 4496 → 3543 ms | fail | [Sketch](live/sketch-language.png); Drawing announcement; plural example incorrectly repeats “The dog”. |
| C12 | literature: How does dramatic irony work in Romeo and Juliet? | 5067 → 4423 ms | fail | [Sketch](live/sketch-literature.png); Drawing announcement; overlapping and clipped labels. |

| C13 | “Show me a picture of a Roman stone aqueduct crossing a green valley” | 4,658 ms generation | pass | Real fal image; reviewed subject match, generated label, Close, restart persistence. [Result](live/image.png), [log](live/media.json). |
| C14 | “Make a short video of a brass pendulum swinging” | 32,252 ms generation | pass | Real fal clip, queued/running/done, six-second media loaded, frame at 2s matches brass pendulum, label/Close/persistence. [Frame](live/video.png). Full motion quality was not reviewed. |
| C15 | First audible words under live voice | — | not testable | Text-only checks avoid voice spend; `firstWordsMs` is not an audio measurement. |
| C16 | Never says “This slide”, drawing announcements, or “I can’t see” | — | fail | 4/12 post-sync answers announce drawings; raw speech in [after.json](live/after.json). No universal guarantee from finite samples. |

## Grounding and gestures

| ID | Scenario | Steps | Expected result | Status | Evidence / reason |
|---|---|---|---|---|---|
| G01 | Real slide in Preview | Open sample PDF full-screen; capture/vision; underline Metabolism | Exact word anchor and visible mark | fail | Preview integration and actual native display differed. Native capture saw Codex, so the word could not be found. This is not a valid slide-grounding result. Guarded retry also rejected the display locally without uploading. See report incident. |
| G02 | Real web article | Share article during hold; mark named phrase | Marks coincide with OCR words | not testable | Native-display mismatch prevents safe repeatable external-screen evidence. |
| G03 | Code in editor | Hold over code; mark named identifier | Correct identifier marked | not testable | Same native-display blocker; no code screenshot sent. |
| G04 | Spreadsheet | Hold over table; mark named cell | Correct cell/figure marked | not testable | Same native-display blocker; no spreadsheet data sent. |
| G05 | Image-only figure | Circle figure and ask what it is | Correct visual identification | not testable | Service fixture passes (G10); no valid real external-figure capture. |
| G06 | OCR distance measurement | Compare mark box with native OCR target box | Zero anchor mismatch; eye-check visible ink | not testable | No valid real-slide target in capture. Synthetic exact-box anchoring passes unit tests, but does not establish real-screen pixel error. |
| G07 | New topic clears drawing | Render answer; send unrelated then related questions | Unrelated clears; related retains | pass | `tests/chats.test.ts`, new-question regression. |
| G08 | Circle a word | Feed generated loop round glycolysis; ask this | Exact selected word and region | pass | `tests/gesture.test.ts` and drawing service tests; synthetic trail only. |
| G09 | Circle sentence across two lines | Supply shuffled wrapped OCR and enclosing loop | Both lines selected in reading order; unrelated word excluded | pass | Cycle 5 gesture regression selects “Energy flows through this system”. Synthetic trace; no physical gesture claim. |
| G10 | Circle picture without text | Feed empty-text loop plus describeSpot fixture | Visual description sent to tutor | pass | `tests/drawing.test.ts`, picture-circle test. Live recognition still unverified. |
| G11 | Sloppy unclosed circle | Feed a wobbly loop with a 36° open gap | Circle accepted and correct word selected | pass | Cycle 5 synthetic regression selects glycolysis. Actual hand-made traces remain not testable in this run (G15). |
| G12 | Point at word | Move then dwell near target | Point region and correct quote | pass | Synthetic trail detector test. |
| G13 | Stray wiggle/swipe | Feed moving, stationary and straight swipe traces | No false circle/point | pass | `tests/gesture.test.ts`; not a broad human-trace dataset. |
| G14 | Cursor ink visible while holding | Send overlay trail events; clear on release | Visible trail, no stale ink | pass | On-screen Electron journey; [cursor evidence](screens/cursor-ink.png). Events are synthetic, not physical pointer validation. |
| G15 | Real hand-made thresholds and ink | Hold global key and circle physically | Stable selection and ink | not testable | CUA app view does not establish the native foreground display; human trace validation remains open. |

## Lectures and chat history

| ID | Scenario | Steps | Expected result | Status | Evidence / reason |
|---|---|---|---|---|---|
| L01 | Upload PDF | Select sample through mocked native file dialog | Imported PDF readable and persisted | pass | Desktop e2e opens rendered PDF, next page and extracted text. File dialog fixture; actual PDF bytes. |
| L02 | Run through lecture quickly | Start fixture lecture; read-ahead/briefing | Prompt first sentence and correct slide context | pass | Full-screen lecture e2e and slides unit test. Live first audible sentence latency not measured. |
| L03 | Title/references filler | Supply filler slides to reader | Skip/brief classification | pass | `tests/slides.test.ts`; model response fixture. |
| L04 | Slide change clears drawings | Draw then navigate | Old annotations disappear | pass | Full-screen lecture e2e and service tests. |
| L05 | Mid-lecture question | Ask via scripted provider during walkthrough | Question and response recorded on current slide | pass | Full-screen lecture e2e. |
| L06 | Continue | Resume saved walkthrough | Correct PDF/page/context | pass | Stage 3 demo and chats unit tests. |
| L07 | Replay narration and drawings | Save, restart, replay, mute | Caption, slide, audio controls and drawings restored | pass | Stage 3 demo; narration uses recorded fixture audio. [Replay](screens/lecture-replay.png). |
| L08 | Delete walkthrough | Delete icon; Escape; Keep; confirm | Cancel preserves; confirm removes walkthrough but keeps PDF | pass | Cycle 2 regression, extended Stage 3 demo. |
| H01 | Topic naming | Ask new subject | Chat filed with relevant title | pass | `tests/chats.test.ts`; classifier fixture. |
| H02 | Related follow-up | Ask related question | Same chat | pass | Same unit test. |
| H03 | New subject | Ask unrelated question | New chat; previous content retained | pass | Same unit test and drawing-clear regression. |
| H04 | Delete chat | Confirm delete | Related history removed, source data preserved | pass | Chat/store service tests and confirmation UI path. |

## Media, help and settings

| ID | Scenario | Steps | Expected result | Status | Evidence / reason |
|---|---|---|---|---|---|
| M01 | Image queue/progress/result | Request fixture image then real aqueduct | Queue to result | pass | Fixture verifies transitions; real image polled queued→done, running too brief to observe. |
| M02 | Video queue/progress/result | Request real pendulum clip | Queued/running/done and playable media | pass | [Media log](live/media.json), loaded metadata and frame capture. |
| M03 | Generated disclosure and Close | Inspect label; click Close | AI-generated/illustrative disclosure; dismiss | pass | Real image/clip check and fixture overlay test. |
| M04 | Failure message / no credit | Inject fal no-credit response | Clear alert, no bogus saved result | pass | Media unit and Electron tests. No deliberate paid-account exhaustion. |
| M05 | Saved restart | Generate; close app; relaunch same temp workspace | Both image and clip saved | pass | Real media log `persisted:true`; [restart](live/media-restart.png). |
| M06 | Subject match | Look at real image and video frame | Requested subject present | pass | Aqueduct and pendulum manually reviewed. Clip motion fidelity not established. |
| M07 | Long Saved titles | Open saved material after restart | Wrapped title; full Unsave button visible | pass | Cycle 4 before/after plus full button-bound assertion. |
| P01 | Offer after threshold, once | Simulate stable OCR over time | One offer only | pass | StuckWatch unit tests plus accelerated Electron timer. |
| P02 | Yoteach foreground | Check native focus gating | No proactive offer while app focused | not testable | Source guard exists; current e2e hides workspace before checking. Native foreground behavior remains unverified. |
| P03 | Wordless screen | Empty OCR through repeated ticks | No offer and no network | pass | Proactive e2e records zero requests; unit test. |
| P04 | Works after Yoyo draws | Finish drawing and wait | Offer can appear after pointing settles | not testable | Pointing returns idle (unit/e2e), and busy guard permits idle, but full native post-drawing sequence not exercised. |
| S01 | Light/dark/system | Select each in Settings | Selected state follows choice | pass | Desktop e2e iterates all three; actual macOS appearance transition not changed. |
| S02 | Talk-key choices | Select all five options | Value accepted; F8 survives restart | pass | Desktop e2e. Physical activation of every modifier not tested. |
| S03 | Yoyo visibility switch | Use Space on Show Yoyo in Settings; restart off and on | Native companion visibility and saved switch agree | pass | Cycle 5 e2e verifies both directions and sidebar hidden status. Uses the existing stored setting. |
| S04 | Proactive switch | Check then uncheck; restart | Off persists | pass | Desktop e2e. |
| S05 | Theme persistence | Set Dark; restart | Dark retained | pass | Desktop e2e and store tests. |

## Yoyo, failures and accessibility

| ID | Scenario | Steps | Expected result | Status | Evidence / reason |
|---|---|---|---|---|---|
| Y01 | Idle/listening/thinking/speaking/pointing/success | Drive runtime fixture states; inspect component variants | Expressive original Violet states | pass | Source states, hold/drawing e2e, canonical editable Figma variants. Static Figma variants do not demonstrate animation timing. |
| Y02 | All four edges | Drag via IPC to extreme corners | Whole companion window inside work area | pass | Desktop e2e checks every corner's bounds. Physical mouse feel not measured. |
| Y03 | Fly and return | Draw grounded arrow from saved home | Point beside target then return to exact home | pass | Hold e2e checks moved bounds, point state and restored bounds. |
| Y04 | Reduced motion | Enable reduced motion; draw; toggle live | Visible final scene, no moving particles, animations stop | pass | Cycle 1 e2e and CSS animation assertion. |
| F01 | Missing keys | Launch blank provider env | Setup status; no unexplained dead CTA | pass | Cycle 3 regression; reads PDFs without provider config. |
| F02 | Network down/auth failure | Reject connection/provider requests | Error, listening released, next hold reconnects | pass | Failed startup e2e; provider unit errors. OS network was not disabled. |
| F03 | fal out of credit | Inject payment-required response | Clear failure, no hang/saved junk | pass | Media fixture tests. |
| F04 | Screen Recording denied | Revoke macOS permission and hold | Clear error, voice still usable | not testable | Permission intentionally not revoked on user's machine; source has error fallback, but OS denial path not executed. |
| F05 | Silent hold | Feed silence/noise into speech detector | No false speech; no stuck capture | pass | `hold-audio.test.ts` detector cases; live microphone silence not tested. |
| F06 | Very long hold | Feed >60 seconds PCM | Explicit one-minute bound | pass | Unit test rejects 62-second buffer. Continuous real hold/network behavior not measured. |
| F07 | Hold cancelled by drag | Begin hold then drag companion | Recording ends; no extra audio sent | pass | Hold e2e checks chunk count and idle state. |
| F08 | Dismiss error | Cause shared runtime error; Dismiss | Error clears and later errors remain possible | pass | Cycle 3 e2e regression. |
| A01 | Keyboard dismissal | Open confirmation; Escape | Dialog closes without deletion | pass | Cycle 2 regression. |
| A02 | Keyboard traversal | Tab through every Settings control; Shift+Tab at first; Escape | All controls reachable; modal contains focus and returns it to trigger | pass | Cycle 5 e2e. Other surfaces use the same Modal; exhaustive traversal of every non-modal app screen is still not established. |
| A03 | Focus rings | Inspect focus-visible styles | Visible ring on interactive controls | pass | CSS source review; no exhaustive screenshot/contrast certification. |
| A04 | Contrast | Review Violet foreground/background tokens | Readable body text in both themes | pass | Design audit/token review and light/dark screenshots; no WCAG certification or full translucency background matrix. |
| A05 | Screen-reader labels | Query app/card/drawing controls by accessible role/name | Meaningful accessible labels | pass | E2e role queries and sketch aria-label assertion; VoiceOver reading order remains not tested. |
| A06 | Live lecture equivalent text | Inspect accessible lecture content | Equivalent explanation for nonvisual learner | not testable | Replay captions exist; full live VoiceOver experience not evaluated. |

## Packaging

| ID | Scenario | Steps | Expected result | Status | Evidence / reason |
|---|---|---|---|---|---|
| B01 | Packaged app identity | Launch release/Yoteach.app | Correct identity and isolated data | not testable | E2e skips this one test because no packaged bundle exists. Development Electron suite still runs in full. |
