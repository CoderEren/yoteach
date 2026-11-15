# Screen annotations and explanatory videos — 15 November 2026

- Screen geometry now uses absolute image pixels, then normalizes in the app. Spatial images are resized locally to fit the standard vision tier; unexpected provider resizing is rejected. Text quotes require contiguous matches. Visual descriptions cannot snap to nearby OCR text.
- Screen mapping uses the full vision model. The local vision setting and example default are now Sonnet 5.5. The hosted voice model is unchanged. Missing visual targets trigger question-specific analysis instead of selecting a nearby caption. Visual confidence below 0.75 is rejected.
- Video requests first produce a validated, three-step causal storyboard. The selected local video model is Kling v3 Pro: three five-second shots, stable scene descriptions, no generated audio. LTX Fast remains supported at 12 seconds. Timed captions and seekable explanation steps are rendered by the app and saved with the clip; existing saved media remain readable.
- The current glass Yoyo's string is black, increased from 2.1 to 3.4 SVG units. Other local mascot changes were preserved.

## Evidence and limitations

Only the user-approved attached study screenshot was sent for this repair's vision tests; no desktop capture was uploaded. The original screenshot already contains the incorrect purple marks. The local replay adds the new cell boxes over that original image, so those old marks remain baked into the evidence image.

Sonnet 4.6's normalized estimates were loose. Sonnet 5.5 with pixel coordinates located the three visible cells substantially better in question-specific analysis. Self-reported confidence is not a guarantee of accuracy, and this is one real screenshot regression, not proof across every diagram.

The first 12-second LTX render was rejected in visual review: cropped cells, inconsistent particles, unclear response. The replacement 15-second Kling render shows release, movement across the extracellular gap, binding at the neighboring cell, and an internal response. Frames across the three steps were inspected. It remains an illustrative generated animation, not a scientifically measured simulation. The replacement took several minutes to render and has a different provider price than LTX.

Local, uncommitted evidence is under `work/paracrine-repair/`: `analysis.json`, `grounding-after.png`, `video.json`, `kling-frames.jpg`, `paracrine.mp4`, and `paracrine-captioned.mp4` (embedded subtitle track). Caption and string UI checks are under `.impeccable/review/`.

Hosted drawing and video instructions were synced and read back successfully. Voice, hosted model, authentication, and override settings were verified unchanged. The configuration backup is `work/agent-visual-1794737602582/`.

The original overnight goal remains paused; this repair does not claim to finish its outstanding native-display proof.

## Validation

Production build, TypeScript and formatting checks pass. All 65 unit tests and 12 Electron end-to-end tests pass; the packaged-app test is skipped because there is no release bundle. Tests use isolated temporary workspaces and scripted providers. New checks cover loose OCR rejection, visual/text separation, pixel normalization, off-image boxes, storyboard validation, bounded three-shot inputs, cancellation before rendering, caption seeking, saved captions, and string styling.

## References

- [Anthropic coordinate guidance](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates)
- [Kling v3 Pro API schema](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/api)
- [LTX Fast API schema](https://fal.ai/models/fal-ai/ltx-2.3/text-to-video/fast/api)
