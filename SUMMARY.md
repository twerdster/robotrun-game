# RobotRun maintenance state

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

## Current implementation

Three lanes, coins worth ten points each, jumping, a 1,000-metre finish and
ten-second fire control reversal implement documented project ideas. Ducking
and overhead beams, the chosen course length, generated layouts, physics and
graphics are new design choices. Every generated row leaves a clear lane.
Seeded simulation runs at fixed 120-Hz steps, independently of rendering.

Webcam input uses Google's Hand Landmarker through @mediapipe/tasks-vision,
one hand, neutral-height calibration, smoothed/debounced mirrored controls and
a half-second hand-loss timeout. Missing hands pause gameplay; reacquisition
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

The production build, 27 Node regressions and 26 portable Chromium browser
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
