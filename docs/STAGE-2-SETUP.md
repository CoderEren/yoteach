# Stage 2 — voice, shared pages and learning memory

Stage 2 adds the real ElevenLabs browser SDK, server-side signed connection URLs, OpenAI visual analysis, grounded annotations and local session history. Stage 3 is not implemented.

## Configure locally

1. Copy `.env.example` to `.env` in the project root. Fill `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and `OPENAI_API_KEY`. Never put private keys in `VITE_*` variables or commit `.env`. Environment variables take precedence over the file.
2. In ElevenLabs, create a conversational agent. Choose its voice and a tool-capable model. Enable authentication so the app can request a signed WebSocket URL. Configure the agent for voice and allow text-only conversation overrides for the text alternative. Ensure client events include agent responses, user transcriptions, interruptions and client tool calls.
3. Use `YOYO-AGENT-PROMPT.md` as the agent's system prompt. Add all six JSON files from `agent-tools/` as **Client** tools with **Wait for response** enabled. Names and parameter names are case-sensitive. Give analysis a 60-second tool response timeout. Configure turn-taking/interruptions in the agent dashboard. The app uses the SDK's actual speaking/listening and interruption events.
4. Restart with `npm run dev`, or `npm run build && npm start`. Settings and Study with Yoyo report whether the needed values are present; this does not prove provider access or valid billing.
5. Grant microphone access to Electron when you press **Start voice session**. Text sessions do not request the microphone. External window sharing also requires Electron in **System Settings → Privacy & Security → Screen & System Audio Recording**, followed by restart when macOS asks. Sharing a page from yoteach's PDF viewer needs no screen-recording permission.

`VISION_MODEL` defaults to `gpt-4.1-mini`. It must support image input and Responses API JSON schema outputs. `VISION_API_KEY` is a fallback alias for `OPENAI_API_KEY`. The app uses the official OpenAI endpoint, not a custom proxy. Do not add fal credentials for Stage 2.

External sharing uses a small compiled macOS CoreGraphics metadata helper. Building it requires Xcode Command Line Tools (`xcode-select --install`) or Xcode; this machine has Xcode. Once built, the helper runs without the compiler. If the helper cannot be built or identify an owner, external sharing fails closed and internal PDF sharing still works. It reads window IDs and application names, never pixels or window titles. Supported owners: Preview, Keynote, Pages, Numbers, Microsoft PowerPoint/Word/Excel, Adobe Acrobat/Reader, Skim, LibreOffice and Obsidian. Browser windows are excluded because private tabs cannot be reliably identified from their titles. Whole-display capture is not offered.

## Test a real conversation

1. Open or import a course PDF and choose a topic. Open **Study with Yoyo**.
2. Check the context-sharing consent, then **Start voice session**. Confirm the connected status and microphone indicator. Say hello and interrupt Yoyo mid-answer to check turn-taking with your agent settings.
3. Choose **Open source PDF**, navigate to a page, and press **Share this page**. A still image appears in the shared-source panel. It stays on that page until you explicitly share another.
4. Ask: “What does this page mean?” or, with the sample course's energy-investment page, “Why does the cell invest ATP before producing it?” The agent should call `analyze_current_screen`, speak the result, and show a grounded annotation.
5. Ask “Circle that title” or “Point to the step you mean.” The agent uses the returned region ID, so marks must remain anchored to the actual shared image. If no reliable region exists, Yoyo should say so.
6. Ask a follow-up, then use **Save explanation** on the answer you want to retain. Or ask Yoyo to save its most recent explanation. Find it in the topic's **Explanations** tab.
7. Press **Stop sharing**. The image and annotations should disappear immediately; another visual request must report that nothing is shared. **Pause** and **End** disconnect voice and clear sharing. Starting again creates a new saved session. **Mute** keeps the connection but stops microphone audio transmission.
8. Quit and reopen. The conversation remains under **Study with Yoyo → Pick up the thread**, and saved explanations remain under the topic. Deleting a session also deletes its saved explanations locally.
9. For an external source, open an eligible document app, choose **Choose window**, select that exact window, and ask about it. Only the selected window is captured, at analysis time. Try closing it, pausing, and stopping sharing. No old annotation should survive a revoked share.

## Data and limits

API keys remain in the main process. The renderer receives only an ephemeral ElevenLabs signed URL and readiness booleans. Selected topic context includes bounded notes, up to four linked page texts, recent messages and up to three saved explanations. The agent handles conversational voice; OpenAI supplies visual context via a client tool. There is no canned voice response or static TTS substitute.

Window video is held locally while sharing; a frame is encoded only for an explicit analysis tool call. PDF sharing renders only the selected page. Images and annotation coordinates are held in memory and never saved by the application. OpenAI requests use `store: false`; your provider retention policies still apply. Stopping sharing cancels pending analysis and rejects late results. It cannot retract data already sent to a provider. Voice audio and provider-side transcripts may be retained according to your ElevenLabs settings. Local delete controls do not delete provider records.

PDF text markers use unique exact text matches and PDF-derived text-run geometry. Duplicate or missing quotes are omitted. Scanned pages and external window markers use model-estimated geometry and are labelled approximate. The image is a still capture, not a live overlay over another application. No arbitrary computer control or continuous background analysis is implemented. Close/reload, app hiding, screen lock and sleep end media sessions. Closing the workspace window alone leaves the session available through Yoyo, as intended for a floating companion; use Pause or End to disconnect.

Vision requests have a 45-second limit; signing has a 15-second limit and SDK connection startup has a 25-second limit. The UI shows measured visual-analysis elapsed time. Actual voice turn latency, network delay and model accuracy must be assessed with your configured agent and representative documents; no live latency claim is made.

## Verification status

Automated coverage uses the actual Electron app and ElevenLabs SDK with isolated fixture transports, plus a silent synthetic-audio stream to verify local worklets, speaking/listening, interruption, mute and complete track shutdown. Thirteen unit tests cover migration, provider request shape, persistence, unique and rotated PDF geometry, cancellation and tool authorization. Fixtures exercise the six tools and follow-up flow without real credentials. These tests do not validate your ElevenLabs account, chosen voice, microphone hardware, provider billing, live model quality, or macOS external capture permissions. Complete the conversation checklist above after configuring credentials.

The mascot restore fix disables native full screen/maximization and reapplies compact or expanded bounds and transparent repaint on Show. Automated tests force an oversized surface and verify recovery. The exact macOS hide/re-show situation in your screenshot still deserves a quick check on your desktop.

Implementation references: [ElevenLabs JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script), [signed-URL authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication), [client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools), [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Electron desktop capture](https://www.electronjs.org/docs/latest/api/desktop-capturer).
