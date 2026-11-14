# Setup required

## Required for Stage 1

Nothing beyond Node.js 22.12+ and npm. Run `npm install`, then `npm run dev`. Installation/first Electron launch needs network access. No API credentials or macOS recording permissions are required.

## When reviewing

- Keep a graphical macOS session active to inspect floating-window behavior.
- If ⌘⇧Y is already used by another app, use the menu bar or workspace's Show Yoyo button. A failed global shortcut registration is logged.
- Test dragging with the grip above Yoyo and hiding/restoring it while another app is frontmost.
- Quit with ⌘Q to fully end the process. Closing the workspace keeps the companion available.

## Can wait until Stage 2 is explicitly approved

- ElevenLabs account, agent configuration and private credentials.
- A chosen vision model and credentials.
- Microphone and screen-recording permissions, requested only when those features exist.

## Can wait until Stage 3 is explicitly approved

- fal account, private key, bounded budget/credits and model selection.

## Publishing

The implementation was successfully pushed to `CoderEren/yoteach` on `stage-1-desktop-foundation` during this run. No additional GitHub authentication is required to review the pushed work. No default-branch merge was performed.

If a later push fails after credentials expire, authenticate Git locally (for example `gh auth login`) with an account that has repository write access. Never paste keys into issues or committed files. Public hosting, Apple Developer enrollment and paid API setup are not required for this stage.
