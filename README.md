# RobotRun

[Play in the browser](https://twerdster.github.io/robotrun-game/)

![Updated browser game screenshot](updated/browser/docs/browser-preview.png)

*Actual output from the updated browser implementation. The historical screenshot remains in the original record.*

![Language: TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6)
![Hand tracking: MediaPipe](https://img.shields.io/badge/hand%20tracking-MediaPipe-0097a7)
![Platform: browser](https://img.shields.io/badge/platform-browser-777777)

A three-lane robot running game controlled by webcam hand tracking, keyboard
or touch. Collect coins, jump barriers and avoid obstacles on a 1,000-metre
course. Fire reverses the controls for ten seconds.

This is a **new browser implementation** under [`updated/browser/`](updated/browser/).
The original Unity source remains unrecovered. The [original project record](original/README.md)
preserves the historical screenshot, documented design, credits and permission
scope; the new code is not presented as the students' original implementation.

Original project: **Hadar Reuveny and Amit Bekerman**, supervised by **Aaron Wetzler**.
New browser implementation: Aaron Wetzler, with coding-agent assistance.

## Run locally

Requires Node.js 22.12 or newer and npm:

```sh
cd updated/browser
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose **Enable camera**, allow webcam
access and hold one hand at a comfortable height to calibrate. Move it left/right
to steer, raise it to jump and lower it to duck. Keyboard/touch controls work
without a camera. Camera use requires HTTPS or localhost; frames stay on device.

`npm run build` checks TypeScript and produces a static `dist/` directory.
`npm test` runs simulation/control regressions. See the
[browser guide](updated/browser/README.md) for controls, hosting and dependencies,
and the [validation record](updated/browser/docs/VALIDATION.md) for executed
checks and limitations. Original Unity/Intel-camera behavior is unvalidated.

New game code is [MIT](updated/browser/LICENSE); third-party components and
historical materials retain their [separate terms](updated/browser/THIRD_PARTY_NOTICES.md).
