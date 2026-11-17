# RobotRun: current maintenance context

Read this file, then SKILL.md, README.md and linked implementation/validation guides.

## Original project and preservation

Historical Unity/Intel-camera game by Hadar Reuveny and Amit Bekerman, supervised by Aaron Wetzler. Original Unity/C# source remains missing. original/README.md and the historical screenshot are preserved; the previous complete root README is additionally retained as PROJECT_RECORD.md.

## Current work — 2026-11-17

The separately written TypeScript/Three.js browser game with optional MediaPipe hand input remains unchanged. The 2026-11-17 deployed check started the game, observed distance progress and paused it with the camera off. Historical overview remains before the Updated section. Original permissions retain their individual stated scopes; none adds a blanket software license.

Aaron requested concise natural README prose and a runnable demo in each Updated section. A real tools-disabled Claude review and follow-up inform the wording; factual suggestions are checked against source and records. The previous full README is preserved as PROJECT_RECORD.md. Existing updated-guide anchors remain available; lengthy implementation/recovery records are linked rather than repeated in the main README.

## Checks and maintenance

Keep original/README.md and historical screenshot unchanged. Never describe the browser game as a compiled original or a source-level port. Preserve local model/Wasm, integrity pins, camera-on-request/video-only behavior, camera cleanup, hand-loss pause/explicit resume, keyboard/touch fallback, minimum 50 ms inference completion gap and deterministic 120-Hz simulation. Use updated/browser guides and recorded 27 Node/28 Chromium scope. Live hand, physical phone and non-Chromium coverage remain unverified.

New static demonstration checks are in updated/demo/VALIDATION.json when present. Actual Chrome desktop/390-pixel interactions were checked; a narrow viewport is not a physical device. No hardware, live microphone/camera recognition or cross-browser coverage is added. Review and synchronize SUMMARY.md and SKILL.md before every commit. Keep private evidence, account details and machine paths outside the repository.
