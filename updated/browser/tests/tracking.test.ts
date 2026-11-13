import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraErrorMessage, HandControlMapper, mirroredPalm, type LandmarkPoint } from '../src/tracking.ts';

/** A synthetic landmark fixture, not a claim that inference detected a real hand. */
function hand(mirroredX = 0.5, y = 0.5): LandmarkPoint[] {
  return Array.from({ length: 21 }, () => ({ x: 1 - mirroredX, y, z: 0 }));
}

function ready(options: ConstructorParameters<typeof HandControlMapper>[0] = {}): HandControlMapper {
  const mapper = new HandControlMapper({
    calibrationMs: 100, calibrationSamples: 3, debounceMs: 80, smoothing: 1, ...options,
  });
  for (const timestamp of [0, 50, 100]) mapper.update(hand(), timestamp);
  assert.equal(mapper.calibrated, true);
  return mapper;
}

test('palm averaging mirrors camera x and ignores moving fingertips', () => {
  const points = hand(0.8, 0.55);
  for (const index of [4, 8, 12, 16, 20]) points[index] = { x: 0.99, y: 0.02 };
  const palm = mirroredPalm(points)!;
  assert.ok(Math.abs(palm.x - 0.8) < 1e-10);
  assert.ok(Math.abs(palm.y - 0.55) < 1e-10);
});

test('incomplete or nonfinite detections cannot generate a control', () => {
  assert.equal(mirroredPalm(null), null);
  assert.equal(mirroredPalm(hand().slice(0, 20)), null);
  const malformed = hand();
  malformed[8].x = NaN;
  assert.equal(mirroredPalm(malformed), null);
});

test('calibration needs time and samples and uses the median against a height outlier', () => {
  const mapper = new HandControlMapper({ calibrationMs: 200, calibrationSamples: 5, smoothing: 1 });
  mapper.update(hand(0.2, 0.5), 0);
  mapper.update(hand(0.2, 0.51), 50);
  mapper.update(hand(0.2, 0.1), 100);
  mapper.update(hand(0.2, 0.49), 150);
  assert.equal(mapper.calibrated, false);
  assert.equal(mapper.control.lane, 0, 'steering stays neutral during calibration');
  mapper.update(hand(0.2, 0.5), 200);
  assert.equal(mapper.calibrated, true);
  assert.equal(mapper.baselineY, 0.5);
  assert.equal(mapper.control.jump, false);
});

test('brief lane excursions are rejected and mirrored right selects the right lane', () => {
  const mapper = ready();
  mapper.update(hand(0.8), 150);
  assert.equal(mapper.control.lane, 0);
  mapper.update(hand(0.5), 200);
  assert.equal(mapper.control.lane, 0);
  mapper.update(hand(0.8), 250);
  mapper.update(hand(0.8), 300);
  assert.equal(mapper.control.lane, 0);
  mapper.update(hand(0.8), 350);
  assert.equal(mapper.control.lane, 1);
});

test('lane hysteresis avoids flickering near a steering threshold', () => {
  const mapper = ready();
  mapper.update(hand(0.3), 150);
  mapper.update(hand(0.3), 250);
  assert.equal(mapper.control.lane, -1);
  for (const [timestamp, x] of [[300, 0.37], [350, 0.40], [400, 0.38]] as const) mapper.update(hand(x), timestamp);
  assert.equal(mapper.control.lane, -1);
  mapper.update(hand(0.5), 450);
  mapper.update(hand(0.5), 550);
  assert.equal(mapper.control.lane, 0);
});

test('raising and lowering the calibrated hand produce exclusive held actions', () => {
  const mapper = ready();
  mapper.update(hand(0.5, 0.3), 150);
  mapper.update(hand(0.5, 0.3), 250);
  assert.deepEqual(mapper.control, { lane: 0, jump: true, duck: false, visible: true });
  mapper.update(hand(0.5, 0.39), 300);
  mapper.update(hand(0.5, 0.39), 400);
  assert.equal(mapper.control.jump, true, 'the release threshold differs from the entry threshold');
  mapper.update(hand(0.5, 0.5), 450);
  mapper.update(hand(0.5, 0.5), 550);
  assert.equal(mapper.control.jump, false);
  mapper.update(hand(0.5, 0.7), 600);
  mapper.update(hand(0.5, 0.7), 700);
  assert.deepEqual(mapper.control, { lane: 0, jump: false, duck: true, visible: true });
});

test('smoothing and debounce reject a one-frame vertical spike', () => {
  const mapper = ready({ smoothing: 0.45 });
  mapper.update(hand(0.5, 0.05), 150);
  mapper.update(hand(), 200);
  mapper.update(hand(), 250);
  mapper.update(hand(), 300);
  assert.equal(mapper.control.jump, false);
});

test('a lost hand clears held actions at the timeout and reacquisition cannot retain them', () => {
  const mapper = ready();
  mapper.update(hand(0.8, 0.7), 150);
  mapper.update(hand(0.8, 0.7), 250);
  assert.equal(mapper.control.duck, true);
  mapper.update(null, 700);
  assert.equal(mapper.control.visible, true, 'short detection gaps get a grace interval');
  mapper.update(null, 750);
  assert.equal(mapper.isLost(750), true);
  assert.deepEqual(mapper.control, { lane: 0, jump: false, duck: false, visible: false });
  mapper.update(hand(), 800);
  assert.deepEqual(mapper.control, { lane: 0, jump: false, duck: false, visible: true });
});

test('absence during initial calibration is reported and old partial samples are discarded', () => {
  const mapper = new HandControlMapper({ calibrationMs: 200, calibrationSamples: 3, smoothing: 1 });
  mapper.update(hand(0.5, 0.2), 0);
  mapper.update(null, 500);
  assert.equal(mapper.isLost(500), true);
  mapper.update(hand(), 550);
  mapper.update(hand(), 600);
  assert.equal(mapper.calibrated, false);
  mapper.update(hand(), 750);
  assert.equal(mapper.baselineY, 0.5);
});

test('pausing an unfinished calibration requires a fresh uninterrupted sampling interval', () => {
  const mapper = new HandControlMapper({ calibrationMs: 650, calibrationSamples: 3, smoothing: 1 });
  mapper.update(hand(0.5, 0.2), 0);
  mapper.update(hand(0.5, 0.2), 50);
  mapper.suspend();
  mapper.update(hand(), 1000);
  mapper.update(hand(), 1050);
  mapper.update(hand(), 1100);
  assert.equal(mapper.calibrated, false, 'time spent paused must not count as calibration time');
  mapper.update(hand(), 1650);
  assert.equal(mapper.calibrated, true);
  assert.equal(mapper.baselineY, 0.5, 'pre-pause heights must not affect the new median');
});

test('out-of-order or nonfinite timestamps do not replace the latest control', () => {
  const mapper = ready();
  mapper.update(hand(0.8), 150);
  mapper.update(hand(0.8), 250);
  const before = mapper.control;
  mapper.update(null, 100);
  mapper.update(null, Infinity);
  assert.deepEqual(mapper.control, before);
});

test('pause clears actions while preserving calibration; recalibrate learns a new height', () => {
  const mapper = ready();
  mapper.update(hand(0.2, 0.3), 150);
  mapper.update(hand(0.2, 0.3), 250);
  mapper.suspend();
  assert.equal(mapper.calibrated, true);
  assert.deepEqual(mapper.control, { lane: 0, jump: false, duck: false, visible: false });
  mapper.recalibrate();
  assert.equal(mapper.calibrated, false);
  for (const timestamp of [300, 350, 400]) mapper.update(hand(0.5, 0.65), timestamp);
  assert.equal(mapper.baselineY, 0.65);
});

test('permission, missing camera, and busy camera errors give actionable messages', () => {
  const named = (name: string): Error => Object.assign(new Error('browser detail'), { name });
  assert.match(cameraErrorMessage(named('NotAllowedError')), /denied.*browser/i);
  assert.match(cameraErrorMessage(named('NotFoundError')), /no camera/i);
  assert.match(cameraErrorMessage(named('NotReadableError')), /other apps/i);
  assert.match(cameraErrorMessage(new Error('HTTP 404: model missing')), /HTTP 404/);
});
