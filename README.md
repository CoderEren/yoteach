# yoteach

A local learning workspace with Yoyo, a floating, conversational desktop tutor. **Stage 2:** courses, PDF roadmaps, voice and text conversations, explicitly shared study pages, grounded visual annotations and saved explanations. Stage 1's approved visual design is preserved.

## Run on macOS

Use Node.js **22.12 or newer** and npm:

```sh
git clone --branch stage-2-voice-and-screen https://github.com/CoderEren/yoteach.git
cd yoteach
npm install
npm run dev
```

The course workspace, PDF reader and mascot work without credentials. For tutoring, follow [Stage 2 setup and real-conversation checklist](docs/STAGE-2-SETUP.md): copy `.env.example` to `.env`, configure ElevenLabs credentials and its six client tools, add an OpenAI key, then restart. Microphone permission is requested only for a voice session. Internal PDF sharing needs no screen-recording permission. External window sharing requires screen-recording permission and the native helper built with Xcode Command Line Tools or Xcode.

For a production build:

```sh
npm run build
npm start
```

The development server binds only to `127.0.0.1:5173`. React changes hot reload; main-process changes need a restart. Quit with **⌘Q**. Closing the workspace leaves Yoyo available; use its Pause or End controls to stop an active session. Hide/show the companion with **⌘⇧Y**, the menu bar or **Show Yoyo**. The companion cannot enter native full screen and restores its bounded transparent surface when shown.

## Use it

1. Create a course, or explore the explicitly labelled sample course.
2. Add a lecture PDF (up to 50 MB / 500 pages). The original is untouched. PDF bookmarks or heading detection create an editable topic roadmap.
3. Rename, nest, reorder and edit topics; add notes. Open a source PDF to read or extract text.
4. Open **Study with Yoyo**, select a topic and consent to sharing its context. Start voice or text. Session state, microphone and sharing controls are explicit.
5. Open a course PDF and **Share this page**, or choose a supported document window. Ask about its visible contents. The agent analyzes that image through the vision tool and marks grounded regions in the source panel.
6. Ask a follow-up or request a circle, arrow, highlight, point or label. Save a useful assistant answer. Revisit it under the topic's **Explanations** tab or the session's local transcript.
7. **Stop sharing** clears the image and annotations. **Pause/End** disconnect voice and stop sharing. Starting again creates a new session. Saved conversations survive restart.

## Scope and limits

ElevenLabs handles live conversational voice, turn-taking and interruptions through its official SDK. OpenAI provides structured visual context through agent tools. Credentials and the configured agent are required for real answers. Automated fixture responses are confined to tests; the product contains no simulated tutor mode.

PDF text annotations use unique matching text runs and actual PDF geometry. External and scanned-page annotations are labelled approximate. They appear over a still image inside the app, not over arbitrary third-party applications. External sharing is restricted to identifiable document apps; browsers and private-labelled windows are excluded. No whole-display or background analysis is offered.

Roadmap extraction is heuristic and editable. Scanned PDFs can be viewed but lack automatic extracted text. Password-protected PDFs are unsupported; import an unlocked copy. The PDF reader does not run embedded scripts or provide editing, forms or hyperlinks. No fal integration, generated interactive lessons, practice engine, universal computer control, proactive assistance or mastery analytics are implemented. Those remain Stage 3 or later.

This is a local macOS development build, not a signed installer. The desktop UI supports windows from 980 × 680; Windows/Linux and mobile are not validated. See [setup and known limitations](docs/STAGE-2-SETUP.md) for provider configuration, retention, latency and external-capture requirements.

## Data and security

Data defaults to `~/Library/Application Support/yoteach/`:

- `workspace.json`: version 2 courses, topics, extracted source text, settings, activity, sessions, transcripts and saved explanations. Stage 1 data migrates automatically. Interrupted sessions are closed on next launch.
- `documents/`: app-owned PDF copies with generated IDs.

The main process validates IPC sender windows, frames and schemas. Renderers receive no filesystem access or API keys; only an ephemeral ElevenLabs signed URL. Context isolation, sandboxing, restricted navigation, a local `yoteach://app` protocol and a restrictive CSP remain enabled. Media permissions are granted only to the session owner for authorized audio or selected-window capture. Audio worklets and their resampler are served locally.

Sharing is explicit. Selected topic data goes to ElevenLabs; images go to OpenAI only for analysis. Screenshots and annotation coordinates remain in memory, never in the local database. Pending results are rejected after stop/source change. OpenAI requests set `store: false`; provider account policies still govern retention. Local deletion does not delete provider-side records. Locking/sleeping or hiding the application ends active media. No camera access is granted.

Atomic snapshots use file sync and rename. Corrupt data is preserved with an error rather than silently reset. Back up the data directory normally; there is no cloud sync. Deleting a course or topic cascades to its local sessions and explanations. Deleting a session removes its transcript and saved explanations. Removing a PDF leaves topic notes and clears source references. Original imported files are never deleted.

For isolated data:

```sh
YOTEACH_DATA_DIR="$PWD/work/test-data" npm run dev
```

Never commit `.env` or put secrets in `VITE_*` variables.

## Verification

```sh
npm run check
npm test
npm run test:e2e
npm run format:check
npm audit
```

Electron tests use temporary data and a real fixture PDF. The SDK journey replaces HTTP/WebSocket transports inside the test harness and exercises the real SDK, IPC, PDF rendering, visual geometry, tools, follow-ups, saving and restart. A separate voice test uses a silent synthetic stream to exercise audio worklets, interruptions, mute and stream shutdown. These tests make no paid provider calls and request no real microphone or screen capture. Screenshots go to ignored `.impeccable/review/`. Unit tests cover migration, storage, provider requests, signed URL validation, grounding and revocation races. Actual voice quality, audio devices and selected external capture require the [manual checklist](docs/STAGE-2-SETUP.md).

## Code map

- `electron/main.ts`: window lifecycle, app protocol, file picker and IPC validation.
- `electron/tutor-ipc.ts`: session ownership, permissions, source selection and privacy lifecycle.
- `electron/tutor.ts`: tools, grounding, session state and cancellation.
- `electron/providers.ts`: signed ElevenLabs connections and structured OpenAI vision requests.
- `electron/store.ts`: atomic persistence and migration.
- `electron/window-sources.ts`, `native/window-owners.swift`: eligible window-owner metadata.
- `shared/model.ts`, `shared/tutor.ts`: typed bridge and validation schemas.
- `src/tutor.tsx`: SDK lifecycle, audio stream cancellation and selected-window frames.
- `src/components/TutorWorkspace.tsx`: study conversation and shared-source annotations.
- `src/pdf.ts`, `src/components/PdfViewer.tsx`: extraction, reading and explicit page sharing.
- `src/components/Yoyo.tsx`, `src/components/Companion.tsx`: visual mascot and actual session controls.
- `docs/agent-tools/`, `docs/YOYO-AGENT-PROMPT.md`: deployable agent tool definitions and prompt.

## Review checkpoint

Stage 1 was approved and Stage 2 was explicitly authorized. Stage 2 implementation is ready for configured live-provider review; live acceptance remains unverified without user credentials. **Do not begin Stage 3 or merge into the default branch without explicit approval.** Historical Stage 1 notes remain in [its review record](docs/STAGE_1_REVIEW.md).
