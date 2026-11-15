# Local setup

1. Use Node >=22.12. Run `npm install --cache ./work/npm-cache`.
2. Keep the ignored `.env` local. Set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ANTHROPIC_API_KEY`, and `VISION_MODEL=claude-sonnet-4-6`. For generated visual analogies add `FAL_KEY`; optionally `FAL_IMAGE_MODEL` (default `fal-ai/flux/schnell`) and `FAL_VIDEO_MODEL` (off by default; recommended `fal-ai/ltx-2.3/text-to-video/fast`).
3. Configure the existing hosted agent using `docs/STAGE-2-SETUP.md`. The system prompt and navigation tool changed.
4. Run `npm run dev`, consent, and choose AI tutor or Lecture walkthrough.
5. For a Finder-launched local app, run `npm run package:mac`. Its `.env` lives in the user-data directory; secrets are not included in the bundle.

Internal PDF sharing needs no Screen Recording permission. Development permissions may belong to Electron or its responsible terminal/IDE. Use the actual macOS prompt identity. See README for complete instructions and verification limits.
