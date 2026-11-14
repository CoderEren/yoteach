# yoteach

A macOS Electron app with two modes: **AI tutor** for ordinary conversational questions, and **Lecture walkthrough** for teaching the actual content of PDF slides. A lavender and icy-blue yo-yo companion stays beside the workspace.

## Run locally

Node 22.12 or newer is required.

```sh
cd ~/Desktop/YoTeach
git switch stage-2-lecture-workflow
npm install --cache ./work/npm-cache
# On a new clone only: cp .env.example .env
npm run dev
```

Keep your existing local `.env`. Set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ANTHROPIC_API_KEY` and optionally `VISION_MODEL` (defaults to `claude-sonnet-4-6`). Never commit keys. The hosted ElevenLabs agent's Claude selection and this app's Anthropic vision key are separate configurations. No OpenAI key is used.

For a production build: `npm run build`, then `npm start`. Restart after changing main-process code or `.env`.

## Use it

- **AI tutor:** consent, then start voice or text. No course, topic or upload is required. You can share a saved PDF page or explicitly choose an eligible document-app window.
- **Lecture walkthrough:** upload a PDF, select it, consent, then click **Run me through the lecture.** The app renders and analyzes the slide, shows Yoyo and asks the real agent to begin teaching. Interrupt with speech or text. Use Previous/Next or ask Yoyo to navigate; every new slide is rendered and analyzed before teaching. Progression pauses for a question/confirmation rather than advancing on a timer. Text is also available.
- **Pause/End:** disconnects the conversation and stops audio tracks, capture and pending analysis. Lecture position is saved. Start the walkthrough again to reconnect at the last slide. This creates a new transcript; it does not restore the previous provider session.
- **Saved material:** imported PDFs, saved explanations and preserved notes. Conversation history is below the tutor. No generated roadmaps, heading extraction, course navigation or future-feature tabs.

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

Voice asks for Microphone access. External selected-window capture needs Screen Recording access. Internal PDF rendering/sharing needs neither screen permission nor the native window-owner helper. Grant only permissions you choose; no privacy databases are reset. After changing permissions, restart the app. Browser/private-labelled windows are excluded. External window ownership uses a small Swift helper built with Xcode Command Line Tools.

Closing the workspace leaves the floating conversation usable. Pause, End, app Hide, lock, sleep, reload or Quit stops media. The companion remains transparent, compact (200×220) or expanded (350×540), and cannot maximize/fullscreen. Show restores its bounds and transparent background.

## Providers, persistence and privacy

The Electron main process holds keys and obtains short-lived ElevenLabs signed WebSocket URLs. Only the main workspace renderer owns the actual ElevenLabs SDK/audio connection; the companion sends controls to it. Narrow validated IPC, renderer sandboxing, context isolation and the local protocol remain enabled.

Conversation/audio goes to ElevenLabs. Explicitly shared images go to Anthropic's Messages API with structured JSON output, then pass runtime validation and grounding. During a consented walkthrough each requested slide is sent for analysis. The app does not continuously capture windows. Stop/revoke cancels analysis and rejects late results. Screenshots and annotation coordinates are runtime-only. Provider retention follows your accounts' policies.

Unique PDF text evidence maps to actual rotated text geometry. Unmatched/duplicate evidence is omitted. Scanned/window estimates are approximate. Annotations appear over the shared image **inside Yoteach**, not across third-party desktop apps.

Data lives in `~/Library/Application Support/yoteach/`. Schema 3 migrates versions 1/2, retains legacy courses/topics/notes/PDFs/sessions/explanations, and makes a pre-migration `workspace.json.v1.backup` or `.v2.backup`. Imported PDFs are retained. New sessions have optional legacy IDs and a lecture document/page association where applicable. Legacy structures are storage compatibility, not product navigation.

## Agent configuration and verification

See [setup](docs/STAGE-2-SETUP.md), the [complete replacement prompt](docs/YOYO-AGENT-PROMPT.md), and the six [tool definitions](docs/agent-tools). `navigate_slide` replaces `open_topic`; the other five tools retain their names. Only text-only conversation override is needed. Prompt/voice/model/first-message overrides remain disabled.

```sh
npm run check
npm test
npm run format:check
npm run build
# Build the optional packaged-app smoke-test target:
# npm run package:mac
npx playwright test
```

Electron UI tests need an ordinary logged-in macOS GUI session. They use isolated temporary workspaces and HTTP/WebSocket fixtures with the real ElevenLabs client. The synthetic voice test does not prove physical-microphone or live-provider quality. See `docs/REVISION-VERIFICATION.md` for this revision's actual results.

Stage 3 visual lessons, generated media and practice engines remain outside this revision.
