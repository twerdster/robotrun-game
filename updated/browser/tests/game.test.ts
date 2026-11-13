import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, MAX_SPEED, RUN_DISTANCE, RunnerGame, type GameInput, type ObstacleType } from '../src/game';

const neutral: GameInput = { lane: 0, jump: false, duck: false };

function emptyGame(): RunnerGame {
  const game = new RunnerGame(42);
  game.start();
  game.state.obstacles = [];
  game.state.pickups = [];
  return game;
}

function obstacleGame(type: ObstacleType, z = 3): RunnerGame {
  const game = emptyGame();
  game.state.obstacles.push({ id: 10000, lane: 0, type, z, cleared: false });
  return game;
}

function advance(game: RunnerGame, seconds: number, input = neutral): void {
  for (let index = 0; index < Math.round(seconds / FIXED_STEP); index += 1) game.update(FIXED_STEP, input);
}

test('same seed and fixed-step input give the same course and state', () => {
  const left = new RunnerGame(321);
  const right = new RunnerGame(321);
  assert.deepEqual(left.state, right.state);
  left.start();
  right.start();
  advance(left, 2, { ...neutral, lane: -1 });
  for (let index = 0; index < 120; index += 1) right.update(1 / 60, { ...neutral, lane: -1 });
  assert.deepEqual(left.state, right.state);
  const other = new RunnerGame(322);
  assert.notDeepEqual(left.state.obstacles.map(value => value.type), other.state.obstacles.map(value => value.type));
});

test('full blocks stop the run and cannot be jumped', () => {
  for (const jump of [false, true]) {
    const game = obstacleGame('block');
    advance(game, 0.4, { ...neutral, jump });
    assert.equal(game.state.phase, 'over');
    const finished = JSON.stringify(game.state);
    advance(game, 1);
    assert.equal(JSON.stringify(game.state), finished);
  }
});

test('barriers require jump clearance; a held jump does not repeat', () => {
  const standing = obstacleGame('barrier');
  advance(standing, 0.4);
  assert.equal(standing.state.phase, 'over');
  const jumping = obstacleGame('barrier');
  advance(jumping, 1.2, { ...neutral, jump: true });
  assert.equal(jumping.state.phase, 'running');
  assert.equal(jumping.state.jumpY, 0);
  assert.equal(jumping.state.obstacles[0].cleared, true);
  jumping.update(FIXED_STEP, { ...neutral, jump: false });
  jumping.update(FIXED_STEP, { ...neutral, jump: true });
  assert.ok(jumping.state.jumpY > 0);
});

test('overhead beams require ducking', () => {
  const standing = obstacleGame('overhead');
  advance(standing, 0.4);
  assert.equal(standing.state.phase, 'over');
  const ducking = obstacleGame('overhead');
  advance(ducking, 0.5, { ...neutral, duck: true });
  assert.equal(ducking.state.phase, 'running');
  assert.equal(ducking.state.ducking, true);
});

test('moving to another lane avoids an incoming block', () => {
  const game = obstacleGame('block', 8);
  advance(game, 0.75, { ...neutral, lane: 1 });
  assert.equal(game.state.phase, 'running');
  assert.equal(game.state.lane, 1);
});

test('fire inverts horizontal and jump/duck controls for ten seconds only once per patch', () => {
  const game = obstacleGame('fire', 0.7);
  game.update(FIXED_STEP, neutral);
  assert.equal(game.state.phase, 'running');
  assert.equal(game.state.burningRemaining, 10);
  game.update(FIXED_STEP, { lane: 1, jump: false, duck: true });
  assert.equal(game.state.targetLane, -1);
  assert.ok(game.state.jumpY > 0, 'lowering/duck input jumps while burning');
  assert.ok(game.state.burningRemaining < 10, 'touching the same patch does not reset its timer');
  for (let index = 0; index < 41; index += 1) {
    game.state.obstacles = [];
    game.state.pickups = [];
    game.update(0.25, neutral);
  }
  assert.equal(game.state.burningRemaining, 0);
  game.update(FIXED_STEP, { ...neutral, lane: 1 });
  assert.equal(game.state.targetLane, 1);
});

test('jumping over fire avoids burning', () => {
  const game = obstacleGame('fire');
  advance(game, 0.6, { ...neutral, jump: true });
  assert.equal(game.state.burningRemaining, 0);
  assert.equal(game.state.phase, 'running');
});

test('fire starting or ending does not make a held pose jump without a fresh input edge', () => {
  const starting = obstacleGame('fire', 0.7);
  starting.update(FIXED_STEP, { ...neutral, duck: true });
  assert.equal(starting.state.burningRemaining, 10);
  starting.update(FIXED_STEP, { ...neutral, duck: true });
  assert.equal(starting.state.jumpY, 0, 'held lower pose must not jump when fire starts');
  starting.update(FIXED_STEP, neutral);
  starting.update(FIXED_STEP, { ...neutral, duck: true });
  assert.ok(starting.state.jumpY > 0, 'a new lower gesture still jumps while burning');

  const ending = emptyGame();
  ending.state.burningRemaining = FIXED_STEP / 2;
  ending.update(FIXED_STEP, { ...neutral, jump: true });
  assert.equal(ending.state.burningRemaining, 0);
  assert.equal(ending.state.ducking, true);
  ending.update(FIXED_STEP, { ...neutral, jump: true });
  assert.equal(ending.state.jumpY, 0, 'held raised pose must not jump when fire ends');
  ending.update(FIXED_STEP, neutral);
  ending.update(FIXED_STEP, { ...neutral, jump: true });
  assert.ok(ending.state.jumpY > 0, 'a fresh normal jump still works after fire ends');
});

test('pause freezes movement, jump physics, score, and fire timer', () => {
  const game = emptyGame();
  game.state.burningRemaining = 6;
  advance(game, 0.2);
  game.pause();
  const snapshot = JSON.stringify(game.state);
  game.update(20, { lane: 1, jump: true, duck: true });
  assert.equal(JSON.stringify(game.state), snapshot);
  game.resume();
  game.update(FIXED_STEP, neutral);
  assert.ok(game.state.distance > JSON.parse(snapshot).distance);
});

test('coins are collected once and contribute ten points each', () => {
  const game = emptyGame();
  game.state.pickups.push({ id: 999, lane: 0, z: 0.6, collected: false });
  game.update(FIXED_STEP, neutral);
  assert.equal(game.state.coins, 1);
  assert.equal(game.state.score, 10);
  advance(game, 0.5);
  assert.equal(game.state.coins, 1);
  assert.equal(game.state.score, 10);
});

test('distance and passed obstacles do not add points', () => {
  const game = obstacleGame('block', 0.5);
  game.state.obstacles[0].lane = -1;
  advance(game, 0.5);
  assert.ok(game.state.distance > 6);
  assert.equal(game.state.obstacles[0].cleared, true);
  assert.equal(game.state.coins, 0);
  assert.equal(game.state.score, 0);
});

test('finish line wins at the configured distance and freezes the simulation', () => {
  const game = emptyGame();
  game.state.distance = RUN_DISTANCE - 0.1;
  game.update(1 / 60, neutral);
  assert.equal(game.state.phase, 'won');
  assert.equal(game.state.distance, RUN_DISTANCE);
  const snapshot = JSON.stringify(game.state);
  game.update(1, neutral);
  assert.equal(JSON.stringify(game.state), snapshot);
});

test('restart restores a reproducible ready course; nonfinite and background deltas do not teleport', () => {
  const game = new RunnerGame(15);
  const initial = JSON.stringify(game.state);
  game.start();
  game.update(Number.NaN, neutral);
  assert.equal(game.state.distance, 0);
  game.update(60, neutral);
  assert.ok(game.state.distance < 4);
  game.reset();
  assert.equal(JSON.stringify(game.state), initial);
});

test('generated rows keep a clear lane and a simple route can finish across 30 seeds', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const game = new RunnerGame(seed);
    game.start();
    let lane = 0;
    const checkedRows = new Set<number>();
    for (let frame = 0; frame < 6000 && game.state.phase === 'running'; frame += 1) {
      const rows = new Map<number, Set<number>>();
      for (const obstacle of game.state.obstacles) {
        const position = Math.round((obstacle.z + game.state.distance) * 100);
        if (!rows.has(position)) rows.set(position, new Set());
        rows.get(position)!.add(obstacle.lane);
      }
      for (const [position, blocked] of rows) {
        assert.ok(blocked.size < 3, `seed ${seed} row ${position} blocks every lane`);
        checkedRows.add(position);
      }
      const next = game.state.obstacles.filter(value => value.z > 0).sort((a, b) => a.z - b.z)[0];
      if (next && next.z < 22) {
        const blocked = new Set(game.state.obstacles.filter(value => Math.abs(value.z - next.z) < 0.1).map(value => value.lane));
        lane = [-1, 0, 1].find(value => !blocked.has(value as -1 | 0 | 1))!;
      }
      game.update(1 / 60, { ...neutral, lane });
      assert.ok(game.state.speed <= MAX_SPEED);
      assert.ok(game.state.obstacles.length < 20);
      assert.ok(game.state.pickups.length < 35);
    }
    assert.equal(game.state.phase, 'won', `clear-lane route failed for seed ${seed}`);
    assert.ok(checkedRows.size > 15);
  }
});
