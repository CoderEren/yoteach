# yoteach

A local learning workspace with Yoyo, a small floating desktop companion. **Stage 1 only**: Electron foundation, courses, lecture PDFs, editable roadmaps, topic notes and mascot previews.

## Run on macOS

Use Node.js **22.12 or newer** and npm. No API keys, Apple Developer account, Xcode project, microphone permission or screen-recording permission are needed.

```sh
git clone --branch stage-1-desktop-foundation https://github.com/CoderEren/yoteach.git
cd yoteach
npm install
npm run dev
```

The first launch downloads the Electron runtime if it is not already cached. Keep an internet connection available for installation and that first download; studying works offline afterward.

For the production build:

```sh
npm run build
npm start
```

`npm run dev` supports React hot reload. Restart it after editing `electron/` or `shared/`. The development server binds only to `127.0.0.1:5173` and refuses to take another port. Close an existing yoteach process before launching another mode. **Quit yoteach with ⌘Q**; closing its workspace window leaves the menu bar and companion available.

## Try it

1. Create a course, or choose **Explore a sample course**. The sample is explicitly labelled and includes a five-page PDF.
2. Choose **Add PDF** and select a lecture. Import copies it into yoteach; the original stays untouched. Up to 50 MB and 500 pages per document.
3. Open a roadmap topic. Rename, reorder, nest or delete it; add your own topics and notes.
4. Open the linked PDF. Use previous/next, page number, zoom, or **Extracted text**. Left/right arrows navigate when the PDF area is focused.
5. Click Yoyo to expand its panel. Try the animation preview states. Drag using the grip above Yoyo, hide it, then restore it from the menu bar, **Show Yoyo**, or **⌘⇧Y**.
6. Change the appearance in Settings (**⌘,**). Quit with **⌘Q**, restart, and verify your courses, PDFs, notes, theme and last topic are still there.

See [docs/STAGE_1_REVIEW.md](docs/STAGE_1_REVIEW.md) for the complete review checklist and verification record. User-only configuration is recorded in [SETUP_REQUIRED.md](SETUP_REQUIRED.md).

## What works

- Secure Electron main process and sandboxed, isolated React renderers.
- Course creation, rename and deletion, workspace search, real recent activity and continue learning.
- Native PDF file selection, local copying, text extraction and an internal PDF.js reader.
- Roadmaps from PDF bookmarks or simple page-heading detection, with manual editing, nesting, ordering and topic notes.
- Topic sections for overview, sources, explanations, lessons, practice and progress.
- A separate transparent, always-on-top Yoyo window; native drag grip, compact preview panel, hide/restore and menu bar controls.
- Seven SVG/CSS expression states: idle, listening, thinking, speaking, pointing, celebrating and unavailable. The panel explicitly labels these as animation previews.
- Atomic local persistence, light/dark/system themes, keyboard focus, native modal focus management and reduced-motion support.

## Deliberate Stage 1 limits

There is **no live voice, screen capture, screen understanding, AI annotation, ElevenLabs, fal, lesson generation, practice assessment or mastery prediction**. Explanations and later learning features have informative placeholders. Opening a topic does not claim learning progress. Screen and microphone permissions are denied by the app in this stage.

PDF organization is heuristic, not AI. Bookmarks take priority; otherwise the app looks for page titles using font sizes and position. Headings may need editing. Scanned documents can be rendered but have no OCR; a starter topic is provided for manual organization. Encrypted/password-protected PDFs are not supported in this stage; import an unlocked copy. The reader provides canvas rendering and extracted text, not full PDF editing, embedded scripts, forms or hyperlinks. Very complex documents may take time to process; keep the application open until import finishes.

No signed installer is included. This is a local development build for the Stage 1 review. The desktop UI targets a minimum 980 × 680 window; this is not a mobile web application. Linux and Windows are not validated.

## Local data and security

By default, data is stored under `~/Library/Application Support/yoteach/`:

- `workspace.json`: versioned metadata, extracted page text, topic notes, settings and recent activity.
- `documents/`: app-owned PDF copies using generated IDs.

The main process validates IPC commands and sender frames. Renderers never receive arbitrary filesystem access or API keys. Packaged renderer assets use the `yoteach://app` protocol; navigation, popups, webviews and permission requests are blocked. A restrictive Content Security Policy allows only bundled resources. Only the main process invokes the native file picker. File IDs are checked against stored documents before reading.

Writes use a temporary file, file sync and atomic rename. An unreadable snapshot is preserved and the app stops with an explanation; it is never silently replaced. There is no cloud sync or automatic backup. Back up the data directory with your normal Mac backup process. Deleting a course deletes its notes, topics, activity and app-owned PDF copies. Deleting a PDF keeps topic notes and removes its source references. Original imported files are never deleted. If an owned file cannot be removed, cleanup retries on the next app launch or data mutation.

For isolated test data, set a directory in the shell before starting (do not point it at another application's data):

```sh
YOTEACH_DATA_DIR="$PWD/work/test-data" npm run dev
```

`.env.example` reserves names for later stages. Stage 1 does not load `.env` or call paid APIs. Never put future secret keys in `VITE_*` variables.

## Verification

```sh
npm run check
npm test
npm run test:e2e
npm audit
```

The end-to-end test launches real Electron windows on a graphical macOS session, uses temporary data, reads a real PDF, edits notes, checks the companion and restarts the app. It stubs the **native file chooser result only** inside the test harness so the test can select the fixture unattended; parsing, storage and rendering use the normal application paths. It requires no downloaded Playwright browser. Screenshots go to the ignored `.impeccable/review/` directory. Unit tests exercise storage invariants and corruption handling.

## Code map

- `electron/main.ts`: window lifecycle, app protocol, permission policy, native file selection and validated IPC.
- `electron/preload.ts`: minimal typed bridge, with no generic IPC access.
- `electron/store.ts`: atomic storage, ownership and relationship validation.
- `shared/model.ts`: shared types and Zod schemas.
- `src/pdf.ts`: local PDF extraction and heading detection.
- `src/components/Yoyo.tsx`: replaceable visual component, separate from `Companion.tsx` behavior.
- `src/styles.css`: reusable colour, typography, surface and motion tokens.
- `PRODUCT.md`, `DESIGN.md`: product scope and design system.

Implementation references: [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [PDF.js examples](https://mozilla.github.io/pdf.js/examples/).

## Stage boundary

Stage 1 is the current review checkpoint. Stage 2 must not begin until the owner explicitly approves it. No default-branch merge is authorized.
