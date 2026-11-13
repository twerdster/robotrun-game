# Maintain RobotRun

Read SUMMARY.md first, then this file, README.md, the original record and the
relevant browser code/guides. New commits use Aaron Wetzler with
409920+twerdster@users.noreply.github.com. Preserve original student credits,
historical authors, the screenshot and third-party terms.

Keep the short root README focused on playing and basic local setup. Explain
implementation details, controls, limitations and test scope in linked guides.
The browser version is newly written updated work: no Unity project/source
was recovered, so never call it a compiled original, source-level port or
historically equivalent build. Keep original material under its own section.

From `updated/browser/`, install with `npm ci`; `npm run dev` prepares assets
and starts Vite. `npm test` runs simulation and control regressions. Build with
`npm run build` (asset verification, TypeScript checking, Vite). Browser tests
use `npm run test:browser` after building; install Playwright Chromium as needed.
For installed Chrome, set PLAYWRIGHT_CHANNEL=chrome. Commands are generic;
do not publish private host paths, camera IDs or machine-specific setup history.

Use only local deployed model/WASM URLs. Preserve model integrity verification
and dependency pins/notices. Include the new-code LICENSE and third-party
license texts/notices in each static build. Keep CSP `connect-src 'self'` so the
SDK's external metrics reporter cannot connect; verify this policy when changing
SDK versions.
Start webcam capture only after an explicit click;
no microphone, recording or frame upload. Retain keyboard/touch fallback,
camera-error handling, stop/cancellation cleanup, calibration, hand-loss pause
and explicit resume. Keep simulation deterministic and rendering read-only.
Keep at least 50 ms between an inference call's completion and the next call;
start-time throttling lets slow synchronous inference monopolize the UI loop.
Preserve the idle render cache and its resize/context-restoration invalidation;
running frames still redraw normally. Browser CI uses one worker and pixel ratio
one to avoid competing software graphics contexts; phone emulation checks CSS
layout/touch, without establishing high-density-screen performance.

Run relevant tests for changes, then inspect real desktop/phone layouts and
actual inference when tracking changes. Separate pure/synthetic landmark tests,
recorded-image inference, a physical live webcam and physical-device evidence.
Do not report broad recognition accuracy, frame-rate benchmarks, historical
equivalence or untested browser/OS compatibility. Label screenshots as current
browser output and keep the historical figure's identity clear.

Before committing, review newly staged binary files and private-data scope,
run git diff --cached --check, verify links/images/notices, and synchronize
SUMMARY.md/SKILL.md. Request real Claude review when directed; check findings
against source and executed results. Push normally and verify CI, Pages and
the actual deployed URLs. Do not rewrite history without explicit instruction.
