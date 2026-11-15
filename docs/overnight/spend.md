# Overnight service usage

Caps: fal 40 images / 4 videos; Anthropic approximately 400 live calls; ElevenLabs 80 conversations. Fixture tests make no paid calls. Attempts are recorded before requests; conservative counts include unsuccessful attempts. Text-only evaluations simulate client tools, so they incur no fal or direct Anthropic calls. ElevenLabs hosted model usage is part of its conversation.

| Time (UTC) | Service | Count | Purpose |
|---|---|---|---|
| 2026-11-15T02:23:30.397Z | ElevenLabs | 1 conversation attempt | before: biology |
| 2026-11-15T02:24:11.595Z | ElevenLabs | 1 conversation attempt | before: biology |
| 2026-11-15T02:24:23.369Z | ElevenLabs | 1 conversation attempt | before: chemistry |
| 2026-11-15T02:24:36.888Z | ElevenLabs | 1 conversation attempt | before: physics |
| 2026-11-15T02:24:50.231Z | ElevenLabs | 1 conversation attempt | before: vectors |
| 2026-11-15T02:25:01.860Z | ElevenLabs | 1 conversation attempt | before: matrices |
| 2026-11-15T02:25:14.152Z | ElevenLabs | 1 conversation attempt | before: calculus |
| 2026-11-15T02:25:26.078Z | ElevenLabs | 1 conversation attempt | before: economics |
| 2026-11-15T02:25:37.588Z | ElevenLabs | 1 conversation attempt | before: history |
| 2026-11-15T02:25:49.245Z | ElevenLabs | 1 conversation attempt | before: computing |
| 2026-11-15T02:26:04.457Z | ElevenLabs | 1 conversation attempt | before: geography |
| 2026-11-15T02:26:18.157Z | ElevenLabs | 1 conversation attempt | before: language |
| 2026-11-15T02:26:32.068Z | ElevenLabs | 1 conversation attempt | before: literature |
| 2026-11-15T02:33:58.430Z | ElevenLabs | 1 conversation attempt | after: biology |
| 2026-11-15T02:34:11.558Z | ElevenLabs | 1 conversation attempt | after: chemistry |
| 2026-11-15T02:34:24.656Z | ElevenLabs | 1 conversation attempt | after: physics |
| 2026-11-15T02:34:37.032Z | ElevenLabs | 1 conversation attempt | after: vectors |
| 2026-11-15T02:34:48.925Z | ElevenLabs | 1 conversation attempt | after: matrices |
| 2026-11-15T02:35:02.483Z | ElevenLabs | 1 conversation attempt | after: calculus |
| 2026-11-15T02:35:13.928Z | ElevenLabs | 1 conversation attempt | after: economics |
| 2026-11-15T02:35:26.164Z | ElevenLabs | 1 conversation attempt | after: history |
| 2026-11-15T02:35:39.681Z | ElevenLabs | 1 conversation attempt | after: computing |
| 2026-11-15T02:35:52.528Z | ElevenLabs | 1 conversation attempt | after: geography |
| 2026-11-15T02:36:05.542Z | ElevenLabs | 1 conversation attempt | after: language |
| 2026-11-15T02:36:18.107Z | ElevenLabs | 1 conversation attempt | after: literature |
| 2026-11-15T08:34:07.718Z | fal | 1 image attempt | Live Electron result and restart check |
| 2026-11-15T08:36:04.801Z | fal | 1 image attempt | Live Electron result and restart check |
| 2026-11-15T08:36:19.808Z | fal | 1 image attempt | Live Electron result and restart check |
| 2026-11-15T08:36:25.346Z | fal | 1 video attempt | Live Electron result and restart check |
| 2026-11-15T08:50:24.365Z | Anthropic | 2 call attempts | Approved sample Preview inventory and analysis |
| 2026-11-15T08:52:30.438Z | Anthropic | 2 call attempts | Approved sample Preview inventory and analysis |
| 2026-11-15T09:02:35.319Z | Anthropic | 2 call attempts | Approved sample Preview inventory and analysis |

## Final accounting

- ElevenLabs: **25 conversation attempts / 80**, comprising 24 completed text conversations plus one DNS failure before connection. No additional voice conversations.
- fal images: **3 logged attempts / 40**, but only **1 provider generation**; two harness failures occurred before the request.
- fal videos: **1 generation / 4**.
- Direct Anthropic: **6 reserved call attempts / approximately 400**, with **2 actual requests** (inventory + analysis) on the unexpected desktop capture. First screen harness failed before capture; the guarded retry rejected locally before network.
- No actual currency total is claimed: provider billing was not queried. Counts stay below every cap. Agent sync/auth requests are configuration operations, not conversations.
- See REPORT.md for the capture incident. No unexpected screen image or OCR is retained in committed evidence.

Cycle 5 used fixture-only tests and Figma documentation. No additional paid provider calls.
| 2026-11-15T10:00:02.224Z | Anthropic | 1 attempt | Paracrine repair: inventory of supplied attachment only |
| 2026-11-15T10:00:59.664Z | Anthropic | 1 attempt | Paracrine repair: inventory of supplied attachment only |
| 2026-11-15T10:01:11.401Z | Anthropic | 1 attempt | Paracrine repair: targeted localization in supplied attachment only |
| 2026-11-15T10:01:31.843Z | Anthropic | 1 attempt | Paracrine repair: three-step paracrine storyboard |
| 2026-11-15T10:04:33.761Z | Anthropic | 1 attempt | Paracrine repair: inventory of supplied attachment only |
| 2026-11-15T10:04:43.921Z | Anthropic | 1 attempt | Paracrine repair: targeted localization in supplied attachment only |
| 2026-11-15T10:04:57.971Z | Anthropic | 1 attempt | Paracrine repair: three-step paracrine storyboard |
| 2026-11-15T10:05:46.825Z | Anthropic | 1 attempt | Paracrine repair: inventory of supplied attachment only |
| 2026-11-15T10:05:52.721Z | Anthropic | 1 attempt | Paracrine repair: targeted localization in supplied attachment only |
| 2026-11-15T10:07:07.417Z | Anthropic | 1 attempt | Paracrine repair: three-step paracrine storyboard |
| 2026-11-15T10:07:12.454Z | fal video | 1 attempt | Paracrine repair: 12-second causal paracrine animation |
| 2026-11-15T10:10:19.383Z | Anthropic | 1 attempt | Paracrine repair: three-step paracrine storyboard |
| 2026-11-15T10:10:25.016Z | fal video | 1 attempt | Paracrine repair: causal paracrine animation model comparison |
| 2026-11-15T10:11:47.353Z | Anthropic | 0 calls | Reused the stored paracrine storyboard |
| 2026-11-15T10:11:47.356Z | fal video | 1 attempt | Paracrine repair: causal paracrine animation model comparison |
