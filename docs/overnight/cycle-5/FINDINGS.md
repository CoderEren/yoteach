# Cycle 5 — discoverable visibility and reliable keyboard focus

| Priority | Finding | Cause / evidence | Fix and verification |
|---|---|---|---|
| P2 | The requested Yoyo visibility switch is absent from Settings. | `before.png`, `regression-before.txt`; show/hide existed in the tray/API but Settings omitted it. | Add a labeled keyboard-operable switch under Appearance, using the existing persisted action. E2e checks off/on, native window visibility and both restart states. |
| P2 | Sidebar claims Yoyo is here after hiding it. | Existing static text. | Status follows stored visibility; e2e asserts “Yoyo is hidden.” |
| P2 | Tab can leave a native dialog and Escape fails to restore its trigger. | `focus-escape-before.txt`, `focus-return-and-audio-before.txt`. | Wrap Tab/Shift+Tab at the dialog boundaries; remember the opener and restore focus on cleanup. E2e visits every Settings control and checks both boundaries and Escape. |
| Test harness | A fixed 500 ms wait sometimes contains too little actual AudioContext input for speech detection. | `focus-return-and-audio-before.txt`; release assertion fails with nine received chunks. | Wait for at least 400 ms of measured PCM bytes before release. All release/cancellation/privacy assertions remain unchanged. This is a stronger input precondition, not a relaxed product assertion. |

Design preceded implementation: [Cycle 5 in Figma](https://www.figma.com/design/U7gOQVHJaS1kQjpAQWLFDm?node-id=24-2). The before screenshot uses Dark and the shipped screenshot System/light; both show the real Settings dialog. This is a control/behavior comparison, not a theme change. The shipped screenshot shows the switch off with a visible keyboard focus ring. Privacy details remain scrollable within the dialog.

Added two synthetic gesture cases: a wrapped sentence selects words in reading order and excludes unrelated text; a wobbly open loop still selects its word. These do not replace physical hand-made validation.

Verification: 59 unit tests, TypeScript, formatting, clean build and full Electron suite. See adjacent logs for final counts. The canonical committed Violet mascot was used for build/e2e; pre-existing user edits were restored byte-for-byte. No schema changes or paid calls. The live native-display blocker remains unchanged; no further external-screen upload was attempted.
