# RobotRun maintenance state

## Updated-work navigation (2026-11-14)

Aaron authorized a top-of-page local `New!` badge and “Updated and ported for modern hardware” link in the root README. Both lead to the matching heading in `updated/README.md`, the new concise entrypoint for the browser implementation, playable game, setup and recorded validation. Its summary explicitly identifies this as newly written work rather than a recovered Unity source port. An italic line identifies the following root content as the historical project reference.

The historical root body, including the previously appended `Updated` section, remains unchanged after removing only the new navigation block. Earlier byte-identity statements refer to their recorded baseline. This documentation-only change leaves all browser code, historical material, assets, dependency pins and validation records unchanged; it adds no runtime evidence.

Read this file, SKILL.md and README.md before changes. The repository preserves
the Technion project record and a separately written browser implementation.
Original students: Hadar Reuveny and Amit Bekerman. Supervisor and maintainer:
Aaron Wetzler. The historical Unity/C# source and Intel camera integration
remain unrecovered; do not describe new code as a compilation or port of them.

`original/README.md` records historical behavior and attribution.
`assets/project-preview.jpg` is the unchanged historical screenshot.
`updated/browser/` contains new TypeScript simulation, procedural Three.js
artwork and MediaPipe webcam input. Original reports/slides recovered privately
contain personal student identifiers and are not redistributed here.

The root README preserves the complete pre-browser project record from commit
`d8b602d`, including its opening screenshot, badges, credits and attribution.
The new browser description, screenshot and play/source/guide links appear only
in the appended `Updated` section. That section clarifies that the preceding
availability and validation statements describe the historical Unity application.

## Current implementation

Three lanes, coins worth ten points each, jumping, a 1,000-metre finish and
ten-second fire control reversal implement documented project ideas. Ducking
and overhead beams, the chosen course length, generated layouts, physics and
graphics are new design choices. Every generated row leaves a clear lane.
Seeded simulation runs at fixed 120-Hz steps, independently of rendering.
Unchanged ready, paused and finished scenes are drawn once rather than on every
animation frame; resizing or restoring the WebGL context invalidates that cache.

Webcam input uses Google's Hand Landmarker through @mediapipe/tasks-vision,
one hand, neutral-height calibration, smoothed/debounced mirrored controls and
a half-second hand-loss timeout. Inference calls leave a minimum 50-ms gap after
completion, rather than immediately repeating a slow synchronous call.
Missing hands pause gameplay; reacquisition
requires explicit resume. Keyboard and touch controls work without a camera.
The camera starts only by request; stopping it closes tracks and the model.
Model and WebAssembly are served locally; camera frames are not uploaded.

## Build and checks

Use Node.js 22.12 or newer and npm from `updated/browser/`: `npm ci`,
`npm run dev`, `npm test`, `npm run build`, `npm run test:browser`.
Development/preview binds loopback by default. Hosted camera access needs
HTTPS; localhost also works. The setup script verifies the pinned model SHA
and copies WebAssembly from locked dependencies, the new-code license and
third-party notices into the deployed files. `dist/` is generated and not
committed. GitHub Actions builds, tests and publishes that directory to Pages.

The production build, 27 Node regressions and 28 portable Chromium browser
checks pass. Separate recorded-hand inference and lifecycle checks are described
in `updated/browser/docs/VALIDATION.md`; do not infer a physical live-hand,
physical-phone or cross-browser result from those fixtures/emulation checks.
No historical Unity build or Intel camera equivalence has been tested.

New game code has its own MIT license under `updated/browser/`; third-party
components/model and original project materials retain separate terms. No
root blanket license or broader student/coauthor permission is assigned.
Private correspondence, raw recovery records, student IDs, machine paths and
test-camera recordings stay outside this repository. Review/synchronize this
file and SKILL.md before commits, and preserve the historical screenshot bytes.
