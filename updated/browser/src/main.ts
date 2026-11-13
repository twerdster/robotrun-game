import './style.css';
import { RunnerGame, type GameInput } from './game';
import { RunnerScene } from './scene';
import { HandTracking, type TrackingStatus } from './tracking';

const get = <T extends HTMLElement = HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element as T;
};
const sceneElement = get('scene');
const shell = document.querySelector<HTMLElement>('.game-shell')!;
const overlay = get('overlay');
const playButton = get<HTMLButtonElement>('play');
const pauseButton = get<HTMLButtonElement>('pause');
const cameraButton = get<HTMLButtonElement>('camera-toggle');
const calibrateButton = get<HTMLButtonElement>('calibrate');
const errorElement = get('camera-error');
const video = get<HTMLVideoElement>('webcam');
const game = new RunnerGame();
let scene: RunnerScene;
let fatal = false;
let mode: 'keyboard' | 'camera' = 'keyboard';
let cameraRequested = false;
let cameraStatus: TrackingStatus = 'idle';
let pausedReason = '';
const keyboard: GameInput = { lane: 0, jump: false, duck: false };
let lastPhase: string = '';
let lastTime = performance.now();
let lastHudTime = 0;
let animationId = 0;
let jumpQueued = false;
let duckQueued = false;

function message(text: string) { get('run-message').textContent = text; }
function clearKeys() { keyboard.jump = false; keyboard.duck = false; jumpQueued = false; duckQueued = false; }

function setMode(next: typeof mode) {
  if (mode === next) return;
  if (game.state.phase === 'running') pause('Controls changed. Ready to continue?');
  clearKeys();
  mode = next;
  get('keyboard-mode').classList.toggle('selected', mode === 'keyboard');
  get('camera-mode').classList.toggle('selected', mode === 'camera');
  get('keyboard-mode').setAttribute('aria-pressed', String(mode === 'keyboard'));
  get('camera-mode').setAttribute('aria-pressed', String(mode === 'camera'));
  get('keyboard-help').hidden = mode !== 'keyboard';
  get('camera-help').hidden = mode !== 'camera';
  document.querySelector<HTMLElement>('.touch-controls')!.hidden = mode === 'camera';
  if (mode === 'keyboard') {
    keyboard.lane = game.state.targetLane * (game.state.burningRemaining > 0 ? -1 : 1);
    stopCamera();
  }
}

const tracker = new HandTracking(video, get<HTMLCanvasElement>('hand-overlay'), {
  onControl(control) {
    sceneElement.dataset.controlLane = String(control.lane);
    sceneElement.dataset.controlJump = String(control.jump);
    sceneElement.dataset.controlDuck = String(control.duck);
    sceneElement.dataset.handVisible = String(control.visible);
  },
  onStatus(status, text) {
    cameraStatus = status;
    get('camera-status').textContent = text;
    get('camera-status').dataset.status = status;
    get('camera-dot').style.background = status === 'tracking' ? '#81e7db' : status === 'error' ? '#ff9765' : '#9295a6';
    get('camera-placeholder').hidden = !['idle', 'loading', 'error'].includes(status);
    calibrateButton.disabled = !tracker.active || status === 'loading';
    if (status === 'error') {
      errorElement.textContent = text + ' Choose Keyboard & touch to play without a camera, or try the camera again.';
      errorElement.hidden = false;
      cameraRequested = false;
      cameraButton.textContent = 'Try camera again';
      if (game.state.phase === 'running' && mode === 'camera') pause('Camera unavailable. Switch controls or try again.');
    } else if (status === 'nohand' && mode === 'camera' && game.state.phase === 'running') {
      pause('Hand lost. Show your hand, then resume.');
    }
    if (status === 'tracking' && game.state.phase !== 'running') message('Hand ready. Press Start or Resume when you are ready.');
  },
}, new URL(import.meta.env.BASE_URL, document.baseURI).href);

function stopCamera() {
  cameraRequested = false;
  tracker.stop();
  cameraButton.textContent = 'Enable camera';
  calibrateButton.disabled = true;
  errorElement.hidden = true;
  if (mode === 'camera' && game.state.phase === 'running') pause('Camera stopped. Enable it or switch controls.');
}

function pause(reason = 'Take a breath. The course can wait.') {
  if (game.state.phase !== 'running') return;
  pausedReason = reason;
  game.pause();
  clearKeys();
  updateOverlay();
}

function play() {
  if (fatal) return;
  if (mode === 'camera' && (!tracker.control.visible || cameraStatus !== 'tracking')) {
    message(cameraRequested ? 'Keep one open hand in view to finish calibration.' : 'Enable your camera below, or choose keyboard & touch.');
    return;
  }
  if (game.state.phase === 'paused') { clearKeys(); game.resume(); }
  else { keyboard.lane = 0; clearKeys(); game.start(); }
  pausedReason = '';
  message('');
  lastTime = performance.now();
  sceneElement.focus({ preventScroll: true });
  updateOverlay();
}

function updateOverlay() {
  const state = game.state;
  sceneElement.dataset.phase = state.phase;
  pauseButton.disabled = !['running', 'paused'].includes(state.phase);
  pauseButton.textContent = state.phase === 'paused' ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', state.phase === 'paused' ? 'Resume game' : 'Pause game');
  overlay.hidden = state.phase === 'running';
  if (state.phase === 'ready') {
    get('eyebrow').textContent = 'READY TO RUN';
    get('overlay-title').innerHTML = 'Make it to<br>1,000 metres.';
    get('overlay-description').innerHTML = 'Find a clear lane. Jump barriers and duck under beams.<br>Watch for fire: it reverses your controls for 10 seconds.';
    playButton.textContent = 'Start running →';
    get('start-hint').textContent = 'Use the keyboard, touch controls, or enable your camera below.';
  } else if (state.phase === 'paused') {
    get('eyebrow').textContent = 'RUN PAUSED';
    get('overlay-title').textContent = 'Right where you left off.';
    get('overlay-description').textContent = pausedReason;
    playButton.textContent = 'Resume run →';
    get('start-hint').textContent = 'Press P or choose Resume to continue.';
  } else if (state.phase === 'over' || state.phase === 'won') {
    const won = state.phase === 'won';
    get('eyebrow').textContent = won ? 'FINISH LINE REACHED' : 'RUN COMPLETE';
    get('overlay-title').textContent = won ? 'One thousand metres. Nicely done.' : 'Another run awaits.';
    get('overlay-description').textContent = `${Math.floor(state.distance)} metres · ${state.coins} coins · ${state.score} points. ${won ? 'You made it through the course.' : 'Find an open lane, jump low barriers and duck under beams.'}`;
    playButton.textContent = 'Run again →';
    get('start-hint').textContent = 'The same course lets you learn each obstacle. Press R to restart.';
  }
  lastPhase = state.phase;
}

playButton.addEventListener('click', play);
pauseButton.addEventListener('click', () => game.state.phase === 'paused' ? play() : pause());
get('keyboard-mode').addEventListener('click', () => setMode('keyboard'));
get('camera-mode').addEventListener('click', () => setMode('camera'));
cameraButton.addEventListener('click', async () => {
  if (cameraRequested) { stopCamera(); return; }
  setMode('camera');
  cameraRequested = true;
  cameraButton.textContent = 'Stop camera';
  errorElement.hidden = true;
  try { await tracker.start(); }
  catch (error) {
    cameraRequested = false;
    cameraButton.textContent = 'Try camera again';
    errorElement.textContent = error instanceof Error ? error.message : 'Camera could not start.';
    errorElement.hidden = false;
  }
});
calibrateButton.addEventListener('click', () => {
  pause('Recalibrating. Hold your hand at a comfortable height.');
  tracker.calibrate();
});

function key(event: KeyboardEvent, down: boolean) {
  if (fatal) return;
  if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName)) return;
  const code = event.code;
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyA','KeyD','KeyW','KeyS','KeyP','KeyR'].includes(code)) return;
  // Enter and Space retain their normal button behavior when a control is focused.
  if (code === 'Space' && (event.target as HTMLElement)?.tagName === 'BUTTON') return;
  event.preventDefault();
  if (down && !event.repeat && code === 'KeyP') { game.state.phase === 'running' ? pause() : game.state.phase === 'paused' && play(); return; }
  if (down && !event.repeat && code === 'KeyR') { game.reset(); updateOverlay(); play(); return; }
  if (mode !== 'keyboard' || game.state.phase !== 'running') return;
  if (down && !event.repeat && ['ArrowLeft','KeyA'].includes(code)) keyboard.lane = Math.max(-1, keyboard.lane - 1);
  if (down && !event.repeat && ['ArrowRight','KeyD'].includes(code)) keyboard.lane = Math.min(1, keyboard.lane + 1);
  if (['ArrowUp','Space','KeyW'].includes(code)) { keyboard.jump = down; if (down && !event.repeat) jumpQueued = true; }
  if (['ArrowDown','KeyS'].includes(code)) { keyboard.duck = down; if (down && !event.repeat) duckQueued = true; }
}
document.addEventListener('keydown', event => key(event, true));
document.addEventListener('keyup', event => key(event, false));
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (mode !== 'keyboard' || game.state.phase !== 'running') return;
    button.setPointerCapture(event.pointerId);
    const action = button.dataset.action;
    if (action === 'left') keyboard.lane = Math.max(-1, keyboard.lane - 1);
    if (action === 'right') keyboard.lane = Math.min(1, keyboard.lane + 1);
    if (action === 'jump') { keyboard.jump = true; jumpQueued = true; }
    if (action === 'duck') { keyboard.duck = true; duckQueued = true; }
  });
  const release = () => { if (button.dataset.action === 'jump') keyboard.jump = false; if (button.dataset.action === 'duck') keyboard.duck = false; };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});
window.addEventListener('resize', () => scene?.resize());
window.addEventListener('blur', () => { clearKeys(); pause('Window inactive. Resume when you are ready.'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearKeys(); pause('Tab hidden. Resume when you are ready.'); tracker.setEnabled(false); }
  else tracker.setEnabled(true);
});
window.addEventListener('pagehide', () => { cancelAnimationFrame(animationId); tracker.dispose(); scene?.dispose(); });
// A cached document contains disposed camera/graphics resources. Reinitialize
// through a clean page load rather than restoring a nonfunctional game.
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });

try { scene = new RunnerScene(sceneElement); }
catch {
  fatal = true;
  get('app').dataset.fatal = 'true';
  get('eyebrow').textContent = 'WEBGL UNAVAILABLE';
  get('overlay-title').textContent = 'This browser cannot render the game.';
  get('overlay-description').textContent = 'Enable hardware acceleration or try a current browser with WebGL 2 support.';
  playButton.disabled = true;
  cameraButton.disabled = true;
  get('start-hint').textContent = 'The project documentation remains available from the source link.';
}

function frame(now: number) {
  if (fatal) return;
  const input = mode === 'camera' ? tracker.control : { ...keyboard, jump: keyboard.jump || jumpQueued, duck: keyboard.duck || duckQueued };
  const previousDistance = game.state.distance;
  game.update((now - lastTime) / 1000, input);
  // A fast press/release must survive until at least one physics step reads it.
  if (game.state.distance > previousDistance) { jumpQueued = false; duckQueued = false; }
  lastTime = now;
  scene.render(game.state, now / 1000);
  if (lastPhase !== game.state.phase) updateOverlay();
  if (now - lastHudTime > 70) {
    get('distance').innerHTML = `${Math.floor(game.state.distance)}<span>m</span>`;
    get('score').textContent = String(game.state.score).padStart(4, '0');
    get('coins').textContent = String(game.state.coins);
    sceneElement.dataset.distance = String(game.state.distance);
    sceneElement.dataset.lane = String(game.state.targetLane);
    sceneElement.dataset.jump = String(game.state.jumpY);
    sceneElement.dataset.duck = String(game.state.ducking);
    shell.dataset.burning = String(game.state.burningRemaining > 0);
    if (game.state.phase === 'running') message(game.state.burningRemaining > 0 ? `FIRE · controls reversed for ${Math.ceil(game.state.burningRemaining)}s` : '');
    lastHudTime = now;
  }
  animationId = requestAnimationFrame(frame);
}
if (!fatal) animationId = requestAnimationFrame(frame);
