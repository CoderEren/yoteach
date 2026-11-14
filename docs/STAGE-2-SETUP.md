# Stage 2 lecture workflow setup

Use the existing agent identified by the local `ELEVENLABS_AGENT_ID`. The local app requires an ElevenLabs key with conversation signing access and an Anthropic key with access to `claude-sonnet-4-6` (or a compatible vision/structured-output model).

The complete system prompt **changed**. Replace it with the text below the separator in [YOYO-AGENT-PROMPT.md](YOYO-AGENT-PROMPT.md). Configure these six client tools from `agent-tools/`, with response waiting enabled:

1. analyze_current_screen
2. highlight_screen_region
3. draw_annotation
4. navigate_slide (replaces/removes open_topic)
5. save_explanation
6. record_learning_interaction

The saved hosted agent's authentication must be enabled; the app requests signed WebSocket URLs in its main process. Allow the conversation `text_only` override for Start with text. No prompt, first-message, voice or model override is required. Select your desired conversational LLM in the hosted agent separately from the app's `ANTHROPIC_API_KEY`.

On 14 November 2026, with the user's explicit authorization, the existing agent named **Yoyo** was updated through the ElevenLabs API with this replacement prompt and six client tool records. Read-back confirmed the exact prompt and six tool IDs; voice, model (Claude Sonnet 4.6), authentication and override settings were unchanged. No duplicate agent was created. The later hold-to-talk revision updated the same prompt and the three screen-tool descriptions in place, preserving all six IDs. The saved first message is now empty so Yoyo waits for the released question (lectures trigger teaching explicitly). No new override is needed. Future clones/accounts must configure their own existing agent.

Start `npm run dev` from the repository. See [README](../README.md) for `.env`, Finder app packaging and macOS permission attribution. No OpenAI key is required.

Provider references used for this implementation:
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs): Messages API `output_config.format` JSON schema, text-block parsing, refusal/truncation handling.
- [Anthropic vision](https://platform.claude.com/docs/en/build-with-claude/vision): base64 JPEG image content blocks.
- [ElevenLabs client tools](https://elevenlabs.io/docs/api-reference/tools/create) and [agent updates](https://elevenlabs.io/docs/api-reference/agents/update): tool records attached by ID.
- [Electron media permissions](https://www.electronjs.org/docs/latest/api/system-preferences) and [desktop capture](https://www.electronjs.org/docs/latest/api/desktop-capturer).

Hold transport uses paced PCM chunks after release; see [ElevenLabs client events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events). macOS fullscreen companion support uses a nonactivating panel and all-Spaces visibility; see [Electron window types](https://www.electronjs.org/docs/latest/api/browser-window).
