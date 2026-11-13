import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page): Promise<void> {
  await page.goto('./');
  expect(new URL(page.url()).pathname).toMatch(/^\/robotrun-game\//);
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('#app')).not.toHaveAttribute('data-fatal', 'true');
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'ready');
}

async function startKeyboard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Keyboard & touch', exact: true }).click();
  await page.locator('#play').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'running');
}

async function distance(page: Page): Promise<number> {
  return Number(await page.locator('#scene').getAttribute('data-distance'));
}

test('starts without opening the camera and supports keyboard steering, jumping and ducking', async ({ page }) => {
  const cameraRequests: string[] = [];
  page.on('request', request => {
    if (/hand_landmarker|vision_wasm/.test(request.url())) cameraRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: (...args: Parameters<typeof original>) => {
        document.documentElement.dataset.cameraRequested = 'true';
        return original(...args);
      },
    });
  });
  await openGame(page);
  await startKeyboard(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#scene')).toHaveAttribute('data-lane', '1');
  await page.keyboard.down('Space');
  await expect.poll(async () => Number(await page.locator('#scene').getAttribute('data-jump'))).toBeGreaterThan(0.15);
  await page.keyboard.up('Space');
  await expect.poll(async () => Number(await page.locator('#scene').getAttribute('data-jump'))).toBe(0);
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#scene')).toHaveAttribute('data-duck', 'true');
  await page.keyboard.up('ArrowDown');
  await expect(page.locator('#scene')).toHaveAttribute('data-duck', 'false');
  expect(await page.locator('html').getAttribute('data-camera-requested')).toBeNull();
  expect(cameraRequests).toEqual([]);
});

test('pause freezes the simulation and resume continues only after an explicit action', async ({ page }) => {
  await openGame(page);
  await startKeyboard(page);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#scene')).toHaveAttribute('data-lane', '-1');
  await expect.poll(() => distance(page)).toBeGreaterThan(1);
  await page.keyboard.press('p');
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'paused');
  await page.waitForTimeout(120); // Let the throttled HUD publish the final paused value.
  const before = await distance(page);
  await page.waitForTimeout(350);
  expect(await distance(page)).toBe(before);
  await page.getByRole('button', { name: 'Resume run' }).click();
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'running');
  await expect.poll(() => distance(page)).toBeGreaterThan(before + 1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'paused');
  await expect(page.locator('#overlay-description')).toContainText('Window inactive');
  await page.getByRole('button', { name: 'Hand tracking', exact: true }).click();
  await expect(page.locator('.touch-controls')).toBeHidden();
  await page.getByRole('button', { name: 'Keyboard & touch', exact: true }).click();
  await expect(page.locator('.touch-controls')).toBeVisible();
  await page.locator('#play').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'running');
  await expect(page.locator('#scene')).toHaveAttribute('data-lane', '-1');
});

test('actions pressed while paused do not become held or queued actions on resume', async ({ page }) => {
  await openGame(page);
  await startKeyboard(page);
  for (const action of ['jump', 'duck'] as const) {
    await page.keyboard.press('p');
    await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'paused');
    await page.getByRole('button', { name: action === 'jump' ? 'Jump' : 'Duck', exact: true }).click();
    const key = action === 'jump' ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
    await page.keyboard.press('p');
    await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'running');
    // Sample across several rendered/HUD updates, rather than checking before a
    // queued action has had the opportunity to reach the physics loop.
    const samples = await page.evaluate(() => new Promise<{ jump: number; duck: string | undefined }[]>(resolve => {
      const result: { jump: number; duck: string | undefined }[] = [];
      const started = performance.now();
      function sample(now: number) {
        const state = document.querySelector<HTMLElement>('#scene')!.dataset;
        result.push({ jump: Number(state.jump), duck: state.duck });
        if (now - started < 350) requestAnimationFrame(sample);
        else resolve(result);
      }
      requestAnimationFrame(sample);
    }));
    await page.keyboard.up(key);
    expect(samples.length).toBeGreaterThan(2);
    expect(samples.every(sample => sample.jump === 0 && sample.duck === 'false')).toBe(true);
  }
});

test('pointer controls steer and release a held duck', async ({ page }) => {
  await openGame(page);
  await startKeyboard(page);
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(page.locator('#scene')).toHaveAttribute('data-lane', '-1');
  const duck = await page.getByRole('button', { name: 'Duck', exact: true }).boundingBox();
  expect(duck).not.toBeNull();
  await page.mouse.move(duck!.x + duck!.width / 2, duck!.y + duck!.height / 2);
  await page.mouse.down();
  await expect(page.locator('#scene')).toHaveAttribute('data-duck', 'true');
  await page.mouse.up();
  await expect(page.locator('#scene')).toHaveAttribute('data-duck', 'false');
  await page.getByRole('button', { name: 'Jump', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('#scene').getAttribute('data-jump'))).toBeGreaterThan(0.1);
});

test('camera permission denial is recoverable and does not prevent keyboard play', async ({ page }) => {
  // Inject a browser API failure; MediaPipe inference and its outputs are not mocked.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw new DOMException('Permission denied for this test', 'NotAllowedError'); },
    });
  });
  await openGame(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.locator('#camera-error')).toBeVisible();
  await expect(page.locator('#camera-error')).toContainText('denied');
  await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'error');
  await expect(page.getByRole('button', { name: 'Try camera again', exact: true })).toBeVisible();
  await expect(page.locator('#calibrate')).toBeDisabled();
  await page.getByRole('button', { name: 'Try camera again', exact: true }).click();
  await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'error');
  await startKeyboard(page);
  await expect.poll(() => distance(page)).toBeGreaterThan(1);
  await expect(page.locator('#camera-error')).toBeHidden();
});

test('a missing model reports HTTP 404 and releases the real fake-device camera stream', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async (...args: Parameters<typeof original>) => {
        const stream = await original(...args);
        (window as unknown as { testCameraTracks: MediaStreamTrack[] }).testCameraTracks = stream.getTracks();
        return stream;
      },
    });
  });
  await page.route('**/models/hand_landmarker.task', route => route.fulfill({ status: 404, body: 'Model missing for error-path test' }));
  await openGame(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.locator('#camera-error')).toContainText('HTTP 404');
  await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'error');
  expect(await page.locator('#webcam').evaluate(video => (video as HTMLVideoElement).srcObject === null)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { testCameraTracks: MediaStreamTrack[] }).testCameraTracks.map(track => track.readyState))).toEqual(['ended']);
  await startKeyboard(page);
  await expect.poll(() => distance(page)).toBeGreaterThan(1);
});

test('stopping during pending camera access releases a late stream without restarting tracking', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async (...args: Parameters<typeof original>) => {
        const stream = await original(...args);
        const state = window as unknown as {
          testCameraTracks: MediaStreamTrack[];
          releaseTestCamera: () => void;
        };
        state.testCameraTracks = stream.getTracks();
        return new Promise<MediaStream>(resolve => { state.releaseTestCamera = () => resolve(stream); });
      },
    });
  });
  await openGame(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseTestCamera?: unknown }).releaseTestCamera)).toBe('function');
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await page.evaluate(() => (window as unknown as { releaseTestCamera: () => void }).releaseTestCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { testCameraTracks: MediaStreamTrack[] }).testCameraTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'idle');
  await expect(page.locator('#camera-error')).toBeHidden();
  expect(await page.locator('#webcam').evaluate(video => (video as HTMLVideoElement).srcObject === null)).toBe(true);
});

test('the local model performs real no-hand inference and the camera can restart', async ({ page }) => {
  // Chromium's fake device supplies its standard moving test pattern, not a hand.
  // This still loads the real WASM/model and executes MediaPipe; no results are substituted.
  const errors: string[] = [];
  const trackingAssets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(models|mediapipe)\//.test(request.url())) trackingAssets.push(request.url());
  });
  await openGame(page);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'nohand', { timeout: 20_000 });
    await expect(page.locator('#camera-error')).toBeHidden();
    await expect(page.locator('#scene')).toHaveAttribute('data-hand-visible', 'false');
    await page.locator('#play').click();
    await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'ready');
    await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
    await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'idle');
    expect(await page.locator('#webcam').evaluate(video => (video as HTMLVideoElement).srcObject === null)).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(trackingAssets.some(url => url.endsWith('/models/hand_landmarker.task'))).toBe(true);
  expect(trackingAssets.some(url => url.endsWith('.wasm'))).toBe(true);
  expect(trackingAssets.every(url => new URL(url).pathname.startsWith('/robotrun-game/'))).toBe(true);
});

test('restart without a tracked hand restores the ready screen after pause or game over', async ({ page }) => {
  test.setTimeout(45_000);
  await openGame(page);
  await startKeyboard(page);
  await page.keyboard.press('p');
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'paused');
  await expect(page.locator('#play')).toContainText('Resume');

  for (const previousPhase of ['paused', 'over'] as const) {
    if (previousPhase === 'over') {
      await startKeyboard(page);
      // The repeatable course starts with a right-lane overhead beam. Running
      // into it without ducking reaches the ordinary game-over UI through play.
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'over', { timeout: 10_000 });
      await expect(page.locator('#play')).toContainText('Run again');
    }
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'nohand', { timeout: 20_000 });
    await expect(page.locator('.touch-controls')).toBeHidden();
    await page.keyboard.press('r');
    await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'ready');
    await expect(page.locator('#eyebrow')).toHaveText('READY TO RUN');
    await expect(page.locator('#overlay-title')).toHaveText(/Make it to\s*1,000 metres\./);
    await expect(page.locator('#play')).toHaveText('Start running →');
    await expect(page.locator('#start-hint')).toContainText('Use the keyboard, touch controls');
    await expect(page.locator('#pause')).toBeDisabled();
    await page.locator('#play').click();
    await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'ready');
    await page.getByRole('button', { name: 'Keyboard & touch', exact: true }).click();
    await expect(page.locator('.touch-controls')).toBeVisible();
  }
});

test('the content security policy blocks external telemetry connections before network dispatch', async ({ page }) => {
  let dispatched = 0;
  // If the policy regresses, intercept the probe so a test still sends no telemetry.
  await page.route('https://odml.pa.googleapis.com/**', route => {
    dispatched += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.addInitScript(() => {
    const state = window as unknown as { testPolicyViolations: string[] };
    state.testPolicyViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      state.testPolicyViolations.push(`${event.effectiveDirective}:${event.blockedURI}`);
    });
  });
  await openGame(page);
  const rejected = await page.evaluate(async () => {
    try {
      await fetch('https://odml.pa.googleapis.com/v1/log', { method: 'POST', body: '{}' });
      return false;
    } catch { return true; }
  });
  expect(rejected).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { testPolicyViolations: string[] }).testPolicyViolations.some(value => value.startsWith('connect-src:https://odml.pa.googleapis.com')),
  )).toBe(true);
  expect(dispatched).toBe(0);
});

test('a frozen video clock becomes unavailable and fresh frames clear the stall warning', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
    const state = window as unknown as { freezeTestVideo: boolean };
    state.freezeTestVideo = true;
    // Preserve the native camera pixels and real model. Only reproduce the stalled
    // video-clock condition that the production loop uses to detect fresh frames.
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return state.freezeTestVideo ? 7 : descriptor.get!.call(this); },
      set: descriptor.set,
    });
  });
  await openGame(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.locator('#camera-status')).toHaveAttribute('data-status', 'nohand', { timeout: 20_000 });
  await expect(page.locator('#camera-status')).toContainText('Camera frames stopped');
  await expect(page.locator('#scene')).toHaveAttribute('data-hand-visible', 'false');
  await expect(page.locator('#scene')).toHaveAttribute('data-control-jump', 'false');
  await expect(page.locator('#scene')).toHaveAttribute('data-control-duck', 'false');
  await page.evaluate(() => { (window as unknown as { freezeTestVideo: boolean }).freezeTestVideo = false; });
  await expect(page.locator('#camera-status')).not.toContainText('Camera frames stopped');
  // A second stall must be detected too, rather than silenced by the first warning.
  await page.evaluate(() => { (window as unknown as { freezeTestVideo: boolean }).freezeTestVideo = true; });
  await expect(page.locator('#camera-status')).toContainText('Camera frames stopped');
  await expect(page.locator('#camera-error')).toBeHidden();
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
});

test('controls fit the viewport and remain reachable at small screen widths', async ({ page }) => {
  await openGame(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Start running' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable camera', exact: true })).toBeVisible();
    const shell = await page.locator('.game-shell').boundingBox();
    for (const action of ['Move left', 'Move right', 'Jump', 'Duck']) {
      const button = await page.getByRole('button', { name: action, exact: true }).boundingBox();
      expect(button!.x).toBeGreaterThanOrEqual(shell!.x);
      expect(button!.x + button!.width).toBeLessThanOrEqual(shell!.x + shell!.width + 1);
    }
  }
});

test('a browser without WebGL receives an explanatory fallback and documentation link', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (/webgl|experimental-webgl/.test(type)) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('./');
  expect(new URL(page.url()).pathname).toMatch(/^\/robotrun-game\//);
  await expect(page.locator('#app')).toHaveAttribute('data-fatal', 'true');
  await expect(page.locator('#overlay-title')).toContainText('cannot render');
  await expect(page.locator('#overlay-description')).toContainText('WebGL');
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#camera-toggle')).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Project & source' })).toHaveAttribute('href', 'https://github.com/twerdster/robotrun-game');
  await page.keyboard.press('r');
  await expect(page.locator('#overlay-title')).toContainText('cannot render');
  await expect(page.locator('#play')).toBeDisabled();
});
