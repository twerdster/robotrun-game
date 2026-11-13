# Third-party components

- `three` 0.187.0: Copyright the Three.js authors, MIT. See
  [THREE-MIT.txt](licenses/THREE-MIT.txt).
- `@mediapipe/tasks-vision` 1.2.3: Copyright the MediaPipe authors, Apache 2.0.
  See [MEDIAPIPE-APACHE-2.0.txt](licenses/MEDIAPIPE-APACHE-2.0.txt) and Google's
  [MediaPipe repository](https://github.com/google-ai-edge/mediapipe).
- Google MediaPipe Hand Landmarker float16 model, revision 1:
  [original model URL](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task).
  SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`,
  7,819,105 bytes. This repository preserves the published model, without
  retraining or modifications. See Google's
  [Hand Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)
  and upstream terms; the new game-code license does not relicense the model.

The production bundle contains the Three.js and MediaPipe runtime code, local
WebAssembly files, and the model. The setup script copies runtime files from the
locked npm package and verifies the model checksum. The running app does not
fetch a CDN or send camera frames to a server. MediaPipe also contains a
performance/utilization metrics reporter; the app's Content Security Policy
restricts connections to the app's own origin, blocking that external reporter.
See Google's [MediaPipe privacy notice](https://developers.google.com/edge/mediapipe/solutions/privacy). Initial dependency installation
and a missing-model download require network access.

Development tools and their dependencies retain their package licenses in the
lockfile and installed distributions. The historical project screenshot and
student-project records outside this directory retain their existing terms.
