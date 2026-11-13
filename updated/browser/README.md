# Updated RobotRun browser implementation

This directory contains new TypeScript code, rather than the unrecovered
Unity source. It renders a procedural three-lane robot course using Three.js.
Google MediaPipe Hand Landmarker supplies webcam landmarks; a control mapper
turns palm position into steering, jumping and ducking. Keyboard and touch
controls need no camera.

## Run or build

Requires Node.js 22.12 or newer and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` verifies assets, checks
TypeScript and creates `dist/`. `npm run preview` serves that compiled output.
Publish the contents of `dist/` to a static HTTPS host. Relative asset paths
also work when hosted under `/robotrun-game/`.

The asset script copies MediaPipe's locked WebAssembly files and verifies the
7.8-MB Hand Landmarker model. If the model file is absent, it downloads the
pinned Google URL and checks its SHA-256 before saving it. npm installation
and that first download require internet access. The running game uses
same-origin assets and has no application server or runtime CDN dependency.

## Play

Reach the 1,000-metre finish. Pick up coins for ten points each. Avoid full-height
blocks, jump low barriers and duck under overhead beams. Touch controls match
the keyboard actions below.

| Action | Keyboard | Webcam hand |
| --- | --- | --- |
| Steer | Left/right or A/D | Move one hand left/right in the mirrored preview |
| Jump | Space, Up or W | Raise the hand above its calibrated height |
| Duck | Down or S, held | Lower the hand below its calibrated height |
| Pause/resume | P or pause button | Use the pause/resume button |
| Restart | R or Run again | Use Run again |

Touching fire reverses steering and swaps jump/duck for ten seconds. During
that effect, lower the hand to jump; raising it ducks. Jumping over fire avoids
the effect. The interface displays the remaining reversal time.

Choose **Enable camera**, allow webcam access, and hold one open hand at a
comfortable height during calibration. Keep the hand visible, then start the
run. **Recalibrate** pauses the game and learns a new neutral height. Hand loss
for half a second pauses the run; show the hand and explicitly resume. Good
lighting and enough space to move help tracking. This is an unmeasured control
interface, not a recognition-accuracy benchmark.

## Camera and browser requirements

Camera access requires HTTPS or localhost and browser permission. WebGL 2,
WebAssembly and JavaScript are required. The app requests video only, runs
inference in the browser, and does not record or upload frames. **Stop camera**
releases the stream and model. A same-origin connection policy also blocks
the SDK's external performance-metrics reporter. Permission denial, disconnected devices or
model-loading failure leave keyboard/touch play available.

The model loop processes new camera frames at most 20 times per second.
`detectForVideo` is synchronous and shares the main thread with rendering;
performance depends on the device. GPU initialization falls back to the CPU
delegate when needed. A hidden tab pauses the run and inference. Browser and
physical-device coverage is limited to the [validation record](docs/VALIDATION.md).

## Implementation and evidence

`src/game.ts` is a seeded, fixed-step simulation; `src/scene.ts` renders state
using new procedural meshes; `src/tracking.ts` calibrates and filters hand
controls and owns camera/model lifetime; `src/main.ts` connects the interface.
Unchanged ready, paused and finished scenes are not redrawn continuously;
running scenes continue to animate.
The 1,000-metre length, generated layouts, collision volumes, movement constants,
ducking and overhead beams are new design choices. Coin scoring, lane selection,
jump and temporary fire reversal follow the recovered project description.
No equivalence to the historical Unity game is claimed.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Node tests cover deterministic simulation, collision/score/fire behavior and
landmark-to-control mapping. Browser tests cover interface and error handling;
the validation record separately identifies actual MediaPipe inference with
recorded input. Neither establishes original Intel-camera compatibility.

New code is [MIT](LICENSE). [Third-party notices](THIRD_PARTY_NOTICES.md) apply
separately to Three.js, MediaPipe and the model. Historical student materials
retain their existing terms in the [original record](../../original/README.md).
