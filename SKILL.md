# Maintain RobotRun

Read SUMMARY.md first, then this file, README.md, PROJECT_RECORD.md and relevant source/guides/validation.

Keep original/README.md and historical screenshot unchanged. Never describe the browser game as a compiled original or a source-level port. Preserve local model/Wasm, integrity pins, camera-on-request/video-only behavior, camera cleanup, hand-loss pause/explicit resume, keyboard/touch fallback, minimum 50 ms inference completion gap and deterministic 120-Hz simulation. Use updated/browser guides and recorded 27 Node/28 Chromium scope. Live hand, physical phone and non-Chromium coverage remain unverified.

## Documentation and demo workflow

Keep README brief: project purpose, author/supervisor credits, current progress, one factual visual, Updated demo and linked setup/evidence/rights. Preserve original work and distinguish recovered execution, new implementations, recorded playback and illustrative reconstructions. Long commands, conversion issues and logs belong in linked guides. Existing updated-guide heading anchors must keep working. The user authorized shortening the root README on 2026-11-17; PROJECT_RECORD.md retains its prior contents, and existing original/ material remains unchanged.

For static demos serve `updated/demo/` over localhost or HTTPS; use Python 3’s HTTP server with that directory. Check real controls, downloads where available, failure handling and desktop/phone-width layout. Use updated/demo/VALIDATION.json for recorded scope and updated/demo/README.md for exact commands. Physical/live-camera/microphone and cross-browser results must not be inferred from desktop automation. Existing native/model apps keep their own build/test/deploy workflows.

When Claude review is requested, invoke it on the actual draft/facts, apply useful feedback after checking the code and retain a truthful review record. Before every commit reread/synchronize SUMMARY.md and this file, check links/images/Markdown and original hashes/pins, inspect the diff and staged files, preserve licensing/attribution and use Aaron Wetzler’s canonical commit identity. Publish normally; never rewrite history without explicit authorization. No private correspondence, access keys, student identifiers or machine-specific setup belongs in public files.
