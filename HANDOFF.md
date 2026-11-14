> Current status (14 November 2026): the user has now explicitly authorized Stage 3 and incremental commits/pushes. See `docs/STAGE-3-HANDOFF.md` for the live checkpoint. Historical stop instructions below are superseded.

# Yoteach — continuation prompt

You are taking over development of my macOS app, yoteach, on a different laptop. Read this entire prompt and the repository before making changes. Implement the revisions below, verify them, commit and push a dedicated revision branch, then stop for my approval before Stage 3. Do not merely produce a plan. Do not merge into the default branch.

## Get the existing project

Repository: https://github.com/CoderEren/yoteach
Current implementation branch: `stage-2-voice-and-screen`.
Stage 2 implementation commit: `0b930241c60a1e232d33c0dd2277b4507187ed24`.
The branch also contains the later handoff/documentation commit containing this file. Fetch its latest tip, not just the implementation commit.

```sh
git clone --branch stage-2-voice-and-screen https://github.com/CoderEren/yoteach.git
cd yoteach
git switch -c stage-2-lecture-workflow
npm install
npm run dev
```

If already checked out, inspect working-tree changes before switching branches; preserve user edits. Node >=22.12 is required. This is Electron/React/TypeScript, built for macOS, not a hosted website. The friend’s machine must obtain its own dependencies, permissions and local .env. The other laptop’s absolute paths, local workspace data and credentials are not portable through GitHub.

## What has happened

Stage 1 was implemented and I explicitly approved its visual design: a calm lavender/icy-blue liquid-glass workspace and floating Yoyo. Stage 2 was then authorized and implemented: real ElevenLabs SDK voice/text sessions, microphone controls, explicit PDF/window sharing, OpenAI visual analysis, grounded annotations, six application tools and local learning history. Stage 3 has NOT been approved or implemented.

I reported a bug where hiding then restoring the app produced a desktop-size black surface with the mascot in the corner. Commit `682c4a7` disables companion full screen/maximization, reapplies compact/expanded bounds and transparent repaint on Show, and adds a regression test that forces an oversized window. Preserve and recheck this fix on the new laptop. The exact original desktop sequence was not manually reproduced in the previous environment.

Before this handoff the developer verified 13 unit tests and 3 real Electron journeys. These used isolated HTTP/WebSocket fixtures, the actual ElevenLabs SDK, a real sample PDF and silent synthetic microphone streams. They cover persistence/migration, six tools, grounding, follow-up, restart, voice worklets, speaking/listening/interruption, mute and stopping tracks. Type checking, formatting and dependency audit passed (zero vulnerabilities at that time). The visual reviewer returned SHIP for supplied UI evidence; DESIGN.md and design.json were preserved. These checks do NOT prove live provider quality, physical microphone access or external capture permissions. I now report that it works on my machine, but inspect the current setup instead of assuming which exact integrations I tested.

## Latest user report: launch and macOS permissions

“Okay it now works but I don't see Electron as an app that is open. I see just the terminal, which is, I think, where the app currently runs. I couldn't add the screen recording access although I gave access to the terminal, not Electron, when it asked me to do so. And it worked. Just for your information.”

Investigate the real launch context and permission attribution on this laptop. Do not insist that the permission entry must always be named Electron. Explain which process/app macOS is actually authorizing. Improve the launch instructions and, if necessary within this scope, a normal macOS app launch/build so the user can identify Yoteach rather than treating it as a terminal-only application. Do not promise signing/notarization or require an Apple Developer account without need. Do not reset macOS privacy databases or grant broad permissions automatically. Internal PDF sharing should continue to work without screen-recording access.

## Required product restructuring — do this BEFORE Stage 3

Replace the current roadmap-centric workspace with exactly two clear modes:

1. **AI tutor.** The usual conversational question-and-answer tutor, with voice, text alternative, mascot, relevant permission-based visual context and useful explanations. It must work without requiring a course/topic or uploaded exercise first.
2. **Lecture walkthrough.** A simple place to upload lecture slides, and one primary button labelled exactly **“Run me through the lecture.”** Clicking it opens the lecture slides, shows the floating mascot, and starts a teacher-like spoken walkthrough of the actual lecture. The agent teaches the content, not merely reads slide titles or waits for the student to ask each question. Ground its explanation in each actual slide, support interruptions and questions, and allow pausing/stopping and sensible slide progression. Start with the existing PDF support; be explicit if PowerPoint or other formats are not supported rather than claiming they are.

Remove everything outside this simplified workflow from the product interface. In particular remove the separate **“Study with Yoyo”** tab, table-of-contents/heading extractor, automatically generated topic roadmaps, and obsolete course/topic navigation and future-feature tabs. Retain functional PDF rendering/text extraction where needed for understanding and teaching actual slide content; removing roadmap extraction does not mean throwing away useful document understanding. Keep only settings, history/saved material and controls that directly serve the two modes; do not recreate the old complex workspace under new labels.

Safely migrate or preserve existing imported PDFs, notes, sessions and saved explanations. Removing navigation is not authorization to silently destroy the user’s data. The current session schema requires topic/course IDs, so implement the actual backend/data-model changes for topic-free tutoring and lecture-linked sessions, not just a cosmetic navigation change. Update agent context, tools, persistence and tests accordingly.

The walkthrough button must initiate real agent teaching. Use appropriate consent for sending lecture content/audio; retain clear microphone and sharing indicators. Do not silently observe all windows or introduce continuous uncontrolled capture. Pause/End must stop relevant audio/capture and cancel stale analysis. Annotations must remain grounded in the actual slide/image, never random positions.

## Anthropic change — explicitly requested, NOT implemented yet

I decided to use an **Anthropic API key instead of OpenAI**. The previous session only created/edited the ignored local `.env` with `ANTHROPIC_API_KEY` and `VISION_MODEL=claude-sonnet-4-6`; it did NOT replace the OpenAI provider implementation. GitHub still contains an OpenAI Responses API vision adapter and OpenAI-oriented .env.example, setup text and tests. Do not mistake an env-variable rename for a working provider migration.

Implement real Anthropic vision/structured-result handling using current official documentation. Update configuration, request/response parsing, cancellation/errors, tests, UI provider disclosures, .env.example and docs. Preserve grounded annotation validation. No OpenAI key should be required for the intended final workflow. Use a currently supported Claude vision model; the previously discussed starting model was Sonnet 4.6, not an immutable mandate if the current API requires a different valid identifier.

## ElevenLabs decision and setup

We chose an **ElevenLabs-hosted conversational agent**, rather than rebuilding speech-to-text -> LLM -> speech-to-speech orchestration ourselves. The app uses ElevenLabs’ real-time conversational SDK for streaming voice, interruptions and turn-taking. The previously recommended conversational LLM in the ElevenLabs agent was Claude Sonnet 4.6, selected from its supported model list. Selecting Claude there and supplying an Anthropic key to this app’s visual-analysis adapter are separate configurations; do not assume the local Anthropic key automatically changes ElevenLabs billing or hosted-agent credentials.

The user has been creating/configuring Yoyo in the ElevenLabs dashboard. Do not create a duplicate agent blindly: inspect the local `ELEVENLABS_AGENT_ID` presence and ask for the existing agent identity if necessary. Authentication belongs in the saved agent’s Security/settings area, not necessarily the creation wizard. The existing app uses signed WebSocket URLs obtained server-side with `ELEVENLABS_API_KEY`. Text/text-only is the only conversation override the current app needs, for “Start with text”; prompt, voice, model and first-message overrides were left disabled.

I asked whether the assistant could create the agent instead of manually configuring it. Yes: the ElevenLabs API supports agent creation/configuration, but an API key restricted to TTS/STT alone is insufficient for agent management. If I authorize programmatic configuration and supply a suitable key locally, configure the intended existing/new agent appropriately. Do not print keys or paste them into chat. Do not claim the hosted agent was updated unless an API/dashboard operation actually succeeded.

Existing agent assets: `docs/YOYO-AGENT-PROMPT.md` and six client tool JSON files under `docs/agent-tools/`. Existing tools are `analyze_current_screen`, `highlight_screen_region`, `draw_annotation`, `open_topic`, `save_explanation`, and `record_learning_interaction`. They genuinely affect the app; tool/parameter names must match the hosted configuration and response-waiting must be enabled. The new workflow will likely require removing/replacing topic navigation and adding lecture navigation/teaching tools. Update code AND provided tool definitions together.

**If the restructuring changes the system prompt, tell me explicitly and provide the complete replacement prompt so I can update it in ElevenLabs.** Also identify tool additions/removals and override changes. Do not silently rely on a dashboard prompt that still describes the old course/topic workflow.

## Mascot replacement — reference image required

“One last thing: change the mascot to the one in the image. The styling of it could still stay. To be honest it's pretty similar to what we already got, but just a Yoyo. The shape changes and the animations would change obviously. For example for the point animation, it would be like a point with its string probably, etc. It changes those animations as well.”

Interpret this as an actual **yo-yo-shaped character**, matching the reference image, rather than the current pear-shaped blob named Yoyo. Preserve the approved lavender/icy-blue frosted-glass styling where it fits the supplied reference. Redesign all relevant animation states: idle, listening, thinking, speaking, pointing, success and error. Pointing should meaningfully use its string. Retain reduced-motion behavior, drag grip, compact transparent always-on-top window and accurate live-state animation.

IMPORTANT: the new yo-yo reference image was NOT attached to the handoff request and is NOT present in GitHub. The earlier available image is a screenshot of the black restore bug, not the replacement character. Ask me to attach the actual mascot reference if it is absent in this new chat. Continue independent backend/workflow work while waiting; do not invent a final reference match or claim to have seen it.

## Current implementation map and constraints

- `electron/main.ts`: windows, trusted local protocol, IPC sender validation, PDF picker, lifecycle and restore fix. Companion compact200x220, expanded350x540. Main window1280x850; minimum980x680.
- `electron/tutor-ipc.ts`: main-process credentials, microphone/display permissions, window selection and media lifecycle.
- `electron/providers.ts`: ElevenLabs signed URL and CURRENT OPENAI vision adapter to replace.
- `electron/tutor.ts`: central runtime, context, tools, grounded regions, cancellation epochs and stale-result rejection.
- `electron/store.ts`: atomic version2 JSON database, migration from version1, documents and session/explanation persistence. Schema changes need another safe migration.
- `shared/model.ts`, `shared/tutor.ts`, `shared/pdf-geometry.ts`: schemas/bridge, runtime types and rotated PDF text geometry.
- `src/tutor.tsx`: actual SDK owner in main workspace renderer, stream tracking, stop during connection startup, selected-window frames. Companion remotely controls it; do not accidentally create duplicate mic connections.
- `src/App.tsx`, `src/components/TutorWorkspace.tsx`, `CourseWorkspace.tsx`: current UI to restructure.
- `src/components/PdfViewer.tsx`, `src/pdf.ts`: PDF rendering, explicit still-page sharing, extracted text and CURRENT roadmap heuristics to remove.
- `src/components/Yoyo.tsx`, `Companion.tsx`, `src/styles.css`: original SVG creature, state/controls and visual tokens.
- `electron/window-sources.ts`, `native/window-owners.swift`: metadata-only macOS helper identifies supported document-app owners; browsers/private-labelled windows excluded. Helper needs Xcode Command Line Tools/Xcode at build time. Internal PDF sharing does not need it.
- `scripts/assets.mjs`: local PDF assets and ElevenLabs audio worklets/resampler; no runtime CDN dependency for these.
- `tests/store.test.ts`, `tests/tutor.test.ts`, `tests/app.e2e.ts`, `tests/tutor.e2e.ts`: existing regression coverage; update it for the new workflow rather than preserving obsolete UI assertions.

Current privacy/security: sandboxed isolated renderers, narrow typed IPC, trusted sender checks, keys in main process, signed ephemeral URLs only in renderer. No arbitrary filesystem IPC, external computer control, remote page navigation or camera permissions. Screenshots/coordinates are runtime-only, not database artifacts. Explicit selected-window/PDF sharing, immediate stop, rejection of late results, media end on app hide/lock/sleep/reload. Closing just the main workspace intentionally leaves the floating session usable; quit/Pause/End stops it. Preserve or clarify these behaviors when simplifying.

Current annotation geometry: PDF unique exact quotes map to actual text-run bounds (including rotated transforms); unmatched/duplicate quotes are omitted. Scanned-page/window annotations use model estimates labelled approximate. Annotations appear over the shared screenshot inside the app; there is no universal third-party desktop overlay. Do not misrepresent that limitation.

Local data defaults to `~/Library/Application Support/yoteach/`; it is NOT in GitHub. `.env`, node_modules, built binaries and screenshots are gitignored. Use `YOTEACH_DATA_DIR` with a temporary directory for tests, not real user data. All .env credentials must be entered locally on the friend’s laptop; do not transmit my secrets through this prompt or GitHub.

## Verification and checkpoint for THIS request

Run meaningful updated tests, type checks, format checks and a production build. Test the actual Electron UI, restart persistence/migration, restore bounds, both modes, lecture progression, questions/interruptions, cancellation, grounded annotations and new mascot states. Use fixtures only in tests and clearly distinguish them from real provider verification. If keys are supplied, test real calls only within the requested workflow, reporting what actually worked and any limits. Do not claim an end-to-end live lecture was tested if only mocked transport ran.

Preserve the approved visual system: read PRODUCT.md, DESIGN.md and `.impeccable/` context. Old roadmap and preview-only descriptions are historical and are superseded by this prompt. Update product/setup documentation to the final simplified behavior. Use the installed frontend skill if applicable on the new machine; do not depend on a skill path from the old laptop. Do not install unrelated hosting services or redesign into a web-only product.

Commit and push the revision branch. Give me the branch/commit, exact run instructions, any required updated ElevenLabs prompt/tool configuration, verification results and remaining limitations. When these adjustments are finished, say **“done”** and stop. That word must mean the authorized revision is finished, not that you skipped missing reference-image work or live setup silently. Do NOT start Stage 3 in the same run. I will approve that separately.

## Stage 3 context — future work, NOT authorized now

The full original product spec is preserved in `docs/ORIGINAL-PRODUCT-SPEC.md`; this prompt supersedes its old roadmap/navigation/mascot requirements and initial “Stage1 only” instructions. Stage1 was approved, Stage2 implemented, and this is a Stage2 restructuring checkpoint. Do not interpret the original spec or “then we’ll proceed” as present Stage3 approval.

After explicit approval, Stage3’s intended capabilities are:

1. Interactive visual lesson viewer with structured steps, React/SVG scenes, spacebar/previous/next navigation, play/pause/replay, voice narration and persistent saved lessons. Start with one excellent scientifically accurate glycolysis example. Requests include “Show me how this works,” “Animate this process,” and “Explain this visually.”
2. At least one REAL fal image/video model integration with contextual requests, progress, errors/latency handling, display, saving and revisiting generated media. Prerecorded assets are not proof of a working integration. No fal integration exists yet.
3. Deterministic programmatic visualizations for accurate process diagrams, scientific explanations, graphs, visual comparisons and manipulable teaching components.
4. ElevenLabs tool calls opening visual lessons while the student continues asking questions.
5. Practice questions, recorded answers, feedback, evidence-based possible misconceptions, review suggestions, saved explanations and persistent visual artifacts. Never infer mastery/confusion from elapsed time alone.
6. Polish animation, mascot interactions, transitions, loading/error states and demonstration reliability.

Original demo: biochemistry lecture -> energy investment explanation -> “Show me what happens” interactive glucose phosphorylation -> genuine fal illustration/clip -> practice response and misconception feedback -> saved history/artifacts survive restart. **Adapt that journey to the new two-mode lecture workflow; do not resurrect removed roadmap or topic tabs just because the old Stage3 spec names them.** Decide the appropriate lecture/session association when Stage3 is authorized.

At Stage3 completion, report branch/commit, demonstrate the coherent journey, distinguish real API tests from fixtures, document setup/limits and ask for final review. Do not invent a fourth stage or unrelated features.
