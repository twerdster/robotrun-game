# Updated browser validation

## Scope

These checks exercise the newly written TypeScript browser implementation.
The original Unity/Intel-camera application remains unbuilt because its source
and dependencies were not recovered. Recorded-image hand inference, browser
phone emulation and a physical live camera/device are separate kinds of evidence.

## Completed checks, 2026-11-13

- `npm run build` passes asset checksum verification, TypeScript checking and
  production bundling. The model and WebAssembly files are served from the
  same origin; the deployed path may include `/robotrun-game/`.
- `npm test` passes 27 tests: 14 simulation regressions and 13 landmark/control
  regressions. They cover deterministic reset, collision/jump/duck, fire reversal
  and timeout (including held poses across fire transitions), ten-point coin scoring, pause, finish, calibration, mirroring,
  filtering, hand loss and timestamp/error cases. One generation test completes
  30 seeded courses by following an available lane; this is not a human-play or
  recognition-accuracy study.
- The portable Playwright suite passes 28 checks: 14 scenarios repeated in
  desktop and phone-emulated Chromium at pixel ratio one. CI runs one worker
  because software graphics and inference share the runner's CPU. It covers keyboard/pointer input,
  short jump taps, ignored inputs during pause, mode-switch lane continuity,
  reset without a tracked hand, blur, viewport widths 320/390/768/1440, denied
  camera access, model HTTP 404, late-start cancellation, repeated camera start/stop,
  real no-hand inference, stalled-video recovery, WebGL fallback and the connection
  policy. Browser API failures and a 404 are intentionally induced for error-path
  tests; MediaPipe inference results are not substituted. One scenario holds
  each wrapped real SDK call for at least 180 ms and checks the
  50-ms gap after completion and camera-button response. That injected delay
  isolates scheduling behavior; it is not a device-performance benchmark.
- A separate Chrome 157 run uses a prerecorded fake-webcam stream derived from
  Google's `right_hands.jpg` test image, translated within a 640×480 frame to
  exercise neutral, left, right, raised, lowered and absent-hand inputs. The real
  Hand Landmarker produces 21-point detections and drives the actual control
  mapper. This checks model loading, landmark production, control integration,
  hand-loss pause and explicit resume/recalibration; it does not measure tracking
  accuracy on diverse live video. The fixture is kept outside this repository.
- Desktop 1440-pixel and phone-width 390-pixel layouts were inspected visually.
  The procedural scene, robot, obstacles, interface and camera overlay render;
  controls remain reachable and no horizontal overflow occurs.
- Separate lifecycle probes cover actual browser permission denial, a missing
  model, camera-track end handling, repeated stop/re-enable and a simulated
  page-visibility transition. Current camera streams close when stopped or
  initialization fails. The page reinitializes after back/forward-cache restoration.
- MediaPipe's external metrics reporter attempts are blocked by the app's
  `connect-src 'self'` policy. The actual SDK endpoint produced a policy-violation
  event with no outgoing request/response in the recorded browser check.
  Camera frames stay in the browser. No runtime CDN assets were requested.
- Actual Claude reviews examined the implementation and documentation.
  Findings led to corrections in input edges, pause/reset behavior, camera-mode
  switching and project-path hosting. Static review does not expand the runtime
  coverage listed above.

## Limits

No physical live-hand session, physical phone, original Intel camera, Safari,
Firefox or other browser/device combination was validated. Phone viewport
emulation is not physical Android/iOS execution. Main-thread synchronous
inference can affect responsiveness on slower devices; the 20-Hz processing cap
is not a measured frame-rate guarantee. No general recognition accuracy,
accessibility audit, battery measurement or historical-game equivalence is claimed.

The original screenshot is unchanged. The README's browser screenshot is actual
output from the updated implementation, without the private hand-image fixture.
Third-party model and library notices remain separate from the new-code license.
