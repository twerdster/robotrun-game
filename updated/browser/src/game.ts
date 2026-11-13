/** New browser implementation; the original Unity source has not been recovered. */
export type Lane = -1 | 0 | 1;
export type ObstacleType = 'barrier' | 'overhead' | 'block' | 'fire';

export interface GameInput {
  lane: number;
  jump: boolean;
  duck: boolean;
}

export interface Obstacle {
  id: number;
  type: ObstacleType;
  lane: Lane;
  /** Metres ahead of the player; the renderer maps this to negative world Z. */
  z: number;
  cleared: boolean;
  triggered?: boolean;
}

export interface Pickup {
  id: number;
  lane: Lane;
  z: number;
  collected: boolean;
}

export interface GameState {
  phase: 'ready' | 'running' | 'paused' | 'over' | 'won';
  /** Continuous lane position during a lateral transition. */
  lane: number;
  targetLane: Lane;
  jumpY: number;
  ducking: boolean;
  distance: number;
  score: number;
  coins: number;
  speed: number;
  burningRemaining: number;
  obstacles: Obstacle[];
  pickups: Pickup[];
}

export const FIXED_STEP = 1 / 120;
export const START_SPEED = 14;
export const MAX_SPEED = 27;
export const LANE_WIDTH = 2.2;
export const RUN_DISTANCE = 1000;
const GRAVITY = 19.5;
const JUMP_SPEED = 7.8;
const LANES: Lane[] = [-1, 0, 1];

/** Deterministic, fixed-step runner simulation. Rendering never advances it. */
export class RunnerGame {
  readonly state: GameState;
  private seed: number;
  private randomState = 1;
  private nextId = 1;
  private nextRow = 65;
  private accumulator = 0;
  private jumpVelocity = 0;
  private previousRawJump = false;
  private previousRawDuck = false;

  constructor(seed = 20261113) {
    this.seed = seed >>> 0;
    this.state = {
      phase: 'ready', lane: 0, targetLane: 0, jumpY: 0, ducking: false,
      distance: 0, score: 0, coins: 0, speed: START_SPEED,
      burningRemaining: 0,
      obstacles: [], pickups: [],
    };
    this.reset();
  }

  reset(seed = this.seed): void {
    this.seed = seed >>> 0;
    this.randomState = this.seed || 0x9e3779b9;
    this.nextId = 1;
    this.nextRow = 65;
    this.accumulator = 0;
    this.jumpVelocity = 0;
    this.previousRawJump = false;
    this.previousRawDuck = false;
    Object.assign(this.state, {
      phase: 'ready', lane: 0, targetLane: 0, jumpY: 0, ducking: false,
      distance: 0, score: 0, coins: 0, speed: START_SPEED,
      burningRemaining: 0,
      obstacles: [], pickups: [],
    });
    this.populate();
  }

  start(seed = this.seed): void {
    this.reset(seed);
    this.state.phase = 'running';
  }

  pause(): void {
    if (this.state.phase === 'running') this.state.phase = 'paused';
  }

  resume(): void {
    if (this.state.phase === 'paused') this.state.phase = 'running';
  }

  /** Long/background frames are capped at 250 ms rather than fast-forwarded. */
  update(dt: number, input: GameInput): void {
    if (this.state.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP && this.state.phase === 'running') {
      this.step(input);
      this.accumulator -= FIXED_STEP;
    }
  }

  private step(input: GameInput): void {
    const state = this.state;
    const burning = state.burningRemaining > 0;
    state.burningRemaining = Math.max(0, state.burningRemaining - FIXED_STEP);
    state.targetLane = Math.max(-1, Math.min(1, Math.round((input.lane || 0) * (burning ? -1 : 1)))) as Lane;
    // A mapping change must not turn an already held pose into a fresh jump.
    const jumpPressed = burning
      ? Boolean(input.duck) && !this.previousRawDuck
      : Boolean(input.jump) && !this.previousRawJump;
    this.previousRawJump = Boolean(input.jump);
    this.previousRawDuck = Boolean(input.duck);
    const duck = Boolean(burning ? input.jump : input.duck);
    state.ducking = duck && state.jumpY < 0.03;
    if (jumpPressed && state.jumpY === 0 && !state.ducking) this.jumpVelocity = JUMP_SPEED;

    if (this.jumpVelocity !== 0 || state.jumpY > 0) {
      state.jumpY += this.jumpVelocity * FIXED_STEP;
      this.jumpVelocity -= GRAVITY * FIXED_STEP;
      if (state.jumpY <= 0) {
        state.jumpY = 0;
        this.jumpVelocity = 0;
      }
    }
    const laneDelta = state.targetLane - state.lane;
    state.lane += Math.sign(laneDelta) * Math.min(Math.abs(laneDelta), 7 * FIXED_STEP);
    state.speed = Math.min(MAX_SPEED, START_SPEED + state.distance * 0.012);
    const travel = state.speed * FIXED_STEP;
    state.distance = Math.min(RUN_DISTANCE, state.distance + travel);

    for (const obstacle of state.obstacles) {
      obstacle.z -= travel;
      if (Math.abs(obstacle.z) <= 0.8 && Math.abs(obstacle.lane - state.lane) < 0.36) {
        if (obstacle.type === 'fire' && !obstacle.triggered && state.jumpY < 0.82) {
          obstacle.triggered = true;
          state.burningRemaining = 10;
        }
        const hit = obstacle.type === 'block'
          || (obstacle.type === 'barrier' && state.jumpY < 0.82)
          || (obstacle.type === 'overhead' && (!state.ducking || state.jumpY > 0.05));
        if (hit) {
          state.phase = 'over';
          break;
        }
      }
      if (!obstacle.cleared && obstacle.z < -1.5) {
        obstacle.cleared = true;
      }
    }

    if (state.phase === 'running') {
      for (const pickup of state.pickups) {
        pickup.z -= travel;
        if (!pickup.collected && Math.abs(pickup.z) < 0.75
          && Math.abs(pickup.lane - state.lane) < 0.45 && state.jumpY < 1.1) {
          pickup.collected = true;
          state.coins += 1;
        }
      }
      state.obstacles = state.obstacles.filter(obstacle => obstacle.z > -15);
      state.pickups = state.pickups.filter(pickup => pickup.z > -15 && !pickup.collected);
      this.populate();
      if (state.distance >= RUN_DISTANCE) state.phase = 'won';
    }
    state.score = state.coins * 10;
  }

  private random(): number {
    let value = this.randomState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.randomState = value >>> 0;
    return this.randomState / 4294967296;
  }

  /** Every row leaves at least one lane clear; rows are at least 42 m apart. */
  private populate(): void {
    const state = this.state;
    while (this.nextRow < Math.min(state.distance + 230, RUN_DISTANCE - 25)) {
      const z = this.nextRow - state.distance;
      const freeLane = LANES[Math.floor(this.random() * LANES.length)];
      const blocked = LANES.filter(lane => lane !== freeLane);
      if (this.random() < 0.35) blocked.splice(Math.floor(this.random() * blocked.length), 1);
      for (const lane of blocked) {
        const choice = this.random();
        const type: ObstacleType = choice < 0.25 ? 'barrier' : choice < 0.48 ? 'overhead' : choice < 0.76 ? 'block' : 'fire';
        state.obstacles.push({ id: this.nextId++, type, lane, z, cleared: false });
      }
      for (let index = 0; index < 4; index += 1) {
        state.pickups.push({ id: this.nextId++, lane: freeLane, z: z - 7 + index * 3, collected: false });
      }
      this.nextRow += 42 + this.random() * 10;
    }
  }
}
