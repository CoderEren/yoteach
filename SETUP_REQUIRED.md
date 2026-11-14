# User configuration for Stage 2

The local workspace and companion need no keys. Real tutoring needs:

- `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in the project-root `.env`.
- An authenticated ElevenLabs agent with the six client tool definitions and supplied prompt.
- `OPENAI_API_KEY` for visual analysis; optional `VISION_MODEL` (default `gpt-4.1-mini`).
- Microphone access for voice; screen-recording access for external window sharing. Internal PDF sharing needs neither screen-recording permission nor the native helper.

Read [the full setup and real-conversation checklist](docs/STAGE-2-SETUP.md). Keys were not present during development. Add them locally; do not paste secrets into chat or commit them.

Xcode/Command Line Tools builds the optional macOS metadata helper for external document windows. This machine has Xcode. No Apple Developer account or signing setup is needed for this development build. No fal configuration is needed until Stage 3 is explicitly approved.
