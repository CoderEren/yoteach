# yoteach

A macOS Electron app with two modes: **AI tutor** for ordinary conversational questions, and **Lecture walkthrough** for teaching the actual content of PDF slides. A lavender and icy-blue yo-yo companion stays beside the workspace.

## Run locally

Node 22.12 or newer is required.

```sh
cd ~/Desktop/YoTeach
git switch stage-3-visual-learning
npm install --cache ./work/npm-cache
# On a new clone only: cp .env.example .env
npm run dev
```

Keep your existing local `.env`. Set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ANTHROPIC_API_KEY` and optionally `VISION_MODEL` (defaults to `claude-sonnet-4-6`). Never commit keys. The hosted ElevenLabs agent's Claude selection and this app's Anthropic vision key are separate configurations. No OpenAI key is used.

For a production build: `npm run build`, then `npm start`. Restart after changing main-process code or `.env`.

## Use it

- **AI tutor:** hold **Control** or Yoyo to speak, then release to send. An icy-green ring means the microphone is listening; a dashed lavender ring means it is preparing/sending. Audio stays in memory until release. No course, topic, source picker or per-question checkbox is required. Start with text is still available in the workspace.
- **Talk key:** change it in Settings (Control, Fn/Globe, Right Control, Right Option or F8). macOS Input Monitoring is needed for a global held key. Fn can also trigger the macOS Globe action; set that action to “Do Nothing” in macOS Keyboard settings if needed. Use an F8 key that sends F8 rather than a media action. These keys are observed without suppressing their normal OS behavior.
- **Move Yoyo:** drag the mascot itself. That position becomes its saved home. A steady hold speaks; moving more than seven pixels cancels recording and starts a drag. Yoyo points with a simple left/right string during grounded explanations and returns home. Click the app’s Dock icon to open the workspace.
- **Screen questions:** a held question automatically captures one still of the display under the pointer. The native capture excludes Yoteach’s own windows. The agent analyzes that still when needed and can highlight, circle, underline or point to grounded regions in a click-through desktop overlay. The marks expire after nine seconds or the spoken turn ends; they are approximate on screen images and do not track content that moves afterward.
- **Lecture walkthrough:** upload a PDF and press **Run me through the lecture**. Slides open full screen and the agent starts teaching from actual slide analysis. Hold to interrupt with a question. The lesson has Previous/Next, hold-to-talk, Pause and End controls. The agent can also navigate slides. No chat or consent panel appears on the lecture page.
- **Visual lesson:** choose “Why invest ATP in glucose?” in AI tutor, or ask Yoyo to show glucose phosphorylation during a conversation. Six authored steps include a phosphate-transfer slider and ATP balance. Space/arrow keys, Previous/Next, Play/Pause and Replay control the visuals. Explain this step uses the existing ElevenLabs voice connection; Stop voice ends it while keeping the lesson open. Hold to ask questions. Playback pauses when listening or speaking. Saved material reopens the last step. Back to lecture restores the current slide.
- **Pause/End:** disconnects the conversation, stops audio/capture, cancels pending analysis and exits lecture full screen. Lecture position is saved. Select the PDF in Saved material to reuse it or upload another lecture; resuming creates a new transcript.

- **Saved material:** visual lessons with their last step, imported PDFs, saved explanations and preserved notes. Conversation history is below the tutor. No generated roadmaps, heading extraction, course navigation or future-feature tabs.

PDF is the supported lecture format (up to 50 MB / 500 pages). Export PowerPoint or Keynote files to PDF first. Scanned pages can be analyzed visually; uncertain regions are labelled approximate.

## Normal macOS application

```sh
npm run package:mac
open release/Yoteach.app
```

The local build creates `release/Yoteach.app` for this Mac and applies an ad-hoc signature. No Apple Developer account is required; this is not a notarized distribution build. Move an existing build aside before rebuilding. The bundle contains no credentials.

A packaged app reads `.env` from its data directory, normally `~/Library/Application Support/yoteach/.env`. Copy your local `.env` there yourself if using the packaged app. Development uses the repository `.env`. `YOTEACH_DATA_DIR` can be passed as an environment variable **before launch** for an isolated workspace; it is not loaded early enough from `.env` to change the data directory.

## Permissions and launch identity

Development runs the Electron executable, launched by Node/npm and the terminal or IDE. macOS may attribute a request to the responsible launching app. Use the identity actually shown in the macOS prompt and Privacy & Security; do not assume an entry must be called Electron. A Finder-launched bundle is named Yoteach and has bundle ID `com.codereren.yoteach`.

Hold-to-talk needs Microphone access. Automatic screen snapshots need Screen Recording; global talk keys need Input Monitoring. These are native macOS permissions, not repeated application consent forms. Internal PDF teaching does not need Screen Recording. Grant only permissions you choose; no privacy databases are reset. After changing permissions, restart the app. The display you activate may contain any app, including a browser: keep the material you want to discuss on it. ScreenCaptureKit captures only that display, not a continuous stream. Native helpers require macOS 14+ and Xcode Command Line Tools to build.

Closing the workspace leaves the floating conversation usable. Pause, End, app Hide, lock, sleep, reload or Quit stops media. The companion remains a transparent 200×220 nonactivating macOS panel, visible across desktops and full-screen Spaces. It cannot maximize/fullscreen itself. Show restores its bounds and transparent background.

## Providers, persistence and privacy

The Electron main process holds keys and obtains short-lived ElevenLabs signed WebSocket URLs. Only the main workspace renderer owns the actual ElevenLabs SDK/audio connection; the companion sends controls to it. Narrow validated IPC, renderer sandboxing, context isolation and the local protocol remain enabled.

Conversation text and released audio go to ElevenLabs. Screen snapshots and lecture slides go to Anthropic's Messages API with structured JSON output, then pass runtime validation and grounding. During a walkthrough each requested slide is sent for analysis. The app does not continuously capture windows. While a visual lesson is open, held questions use its authored step context instead of capturing the external desktop. Stop/revoke cancels analysis and rejects late results. Screenshots and annotation coordinates are runtime-only. Provider retention follows your accounts' policies.

Unique PDF text evidence maps to actual rotated text geometry. Unmatched/duplicate evidence is omitted. Scanned/screen estimates are approximate. Grounded annotations appear over the full-screen slide or as temporary click-through desktop marks. The mascot moves beside the chosen region without changing its saved home.

Data lives in `~/Library/Application Support/yoteach/`. Schema 4 migrates versions 1/2/3, retains legacy courses/topics/notes/PDFs/sessions/explanations, and makes a pre-migration `workspace.json.v1.backup` , `.v2.backup` or `.v3.backup`. Imported PDFs are retained. New sessions have optional legacy IDs and a lecture document/page association where applicable. Legacy structures are storage compatibility, not product navigation.

## Agent configuration and verification

See [setup](docs/STAGE-2-SETUP.md), the [complete replacement prompt](docs/YOYO-AGENT-PROMPT.md), and the eight [tool definitions](docs/agent-tools). `navigate_slide` replaces `open_topic`. Stage 3 adds `open_visual_lesson` and `navigate_visual_lesson`; the previous six tools are preserved. Only text-only conversation override is needed. Prompt/voice/model/first-message overrides remain disabled.

```sh
npm run check
npm test
npm run format:check
npm run build
# Build the optional packaged-app smoke-test target:
# npm run package:mac
npx playwright test
# Also exercise Vite prebundling (voice regression):
YOTEACH_TEST_DEV=1 npx playwright test tests/tutor.e2e.ts
```

Electron UI tests need an ordinary logged-in macOS GUI session. They use isolated temporary workspaces and HTTP/WebSocket fixtures with the real ElevenLabs client. The synthetic voice test does not prove physical-microphone or live-provider quality. See `docs/STAGE-3-HANDOFF.md` for current results and `docs/HOLD-TO-TALK-VERIFICATION.md` for the previous revision.

The ElevenLabs SDK remains responsible for hosted conversations, recognition, output audio, tools and turn-taking. The SDK is pinned to 1.36.1 because the hold adapter reuses its platform output classes. A bounded local AudioWorklet records at most one minute and releases PCM chunks at the provider’s real-time cadence followed by silence for hosted end-of-turn detection. The microphone track stops on release/cancel. Sending therefore takes roughly the recorded question’s duration, then the hosted agent replies. Changing SDK versions requires rerunning the held-audio and interruption tests.

“Yo teach” wake-word activation is **not implemented**. Reliable background wake detection needs a separate always-listening engine and permission/CPU work; browser speech recognition is not a reliable drop-in for this Electron app.

Stage 3 is in progress. The authored visual lesson, fal-generated visual analogies and evidence-based practice (answers, feedback, possible misconceptions, review suggestions) are implemented, with an automated lecture → lesson → media → practice → restart journey. See [the resumable checkpoint](docs/STAGE-3-HANDOFF.md). Set `FAL_KEY` in `.env` to generate images (default model `fal-ai/flux/schnell`, override with `FAL_IMAGE_MODEL`). Short clips are off until `FAL_VIDEO_MODEL` names a fal text-to-video model.
