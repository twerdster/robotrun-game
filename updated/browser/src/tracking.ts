import type { HandLandmarker } from '@mediapipe/tasks-vision';

export type Lane = -1 | 0 | 1;
export interface HandControl {
  lane: Lane;
  jump: boolean;
  duck: boolean;
  visible: boolean;
}
export type TrackingStatus =
  | 'idle' | 'loading' | 'calibrating' | 'tracking' | 'nohand' | 'paused' | 'error';
export interface TrackingCallbacks {
  onControl?: (control: HandControl) => void;
  onStatus?: (status: TrackingStatus, message: string) => void;
}
export interface LandmarkPoint { x: number; y: number; z?: number }
export interface PalmPoint { x: number; y: number }
export interface MapperOptions {
  calibrationMs?: number;
  calibrationSamples?: number;
  debounceMs?: number;
  lostAfterMs?: number;
  smoothing?: number;
}

const neutral = (): HandControl => ({ lane: 0, jump: false, duck: false, visible: false });
const PALM_INDICES = [0, 5, 9, 13, 17] as const;

/** Palm coordinates in the mirrored preview, independent of handedness labels. */
export function mirroredPalm(landmarks: readonly LandmarkPoint[] | null): PalmPoint | null {
  if (!landmarks || landmarks.length !== 21) return null;
  if (landmarks.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  const x = PALM_INDICES.reduce<number>((sum, index) => sum + landmarks[index].x, 0) / PALM_INDICES.length;
  const y = PALM_INDICES.reduce<number>((sum, index) => sum + landmarks[index].y, 0) / PALM_INDICES.length;
  // Out-of-frame landmarks can occur during tracking; do not let extreme values become controls.
  return { x: Math.max(0, Math.min(1, 1 - x)), y: Math.max(0, Math.min(1, y)) };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Stateful, camera-independent filtering of landmark frames into game controls. */
export class HandControlMapper {
  private current: HandControl = neutral();
  private smooth: PalmPoint | null = null;
  private baseline: number | null = null;
  private samples: number[] = [];
  private calibrationStarted: number | null = null;
  private lastSeen: number | null = null;
  private firstFrame: number | null = null;
  private lastTimestamp = -Infinity;
  private laneCandidate: Lane = 0;
  private laneCandidateSince = 0;
  private pose: 'neutral' | 'jump' | 'duck' = 'neutral';
  private poseCandidate: 'neutral' | 'jump' | 'duck' = 'neutral';
  private poseCandidateSince = 0;
  private readonly options: Required<MapperOptions>;

  constructor(options: MapperOptions = {}) {
    this.options = {
      calibrationMs: options.calibrationMs ?? 650,
      calibrationSamples: options.calibrationSamples ?? 10,
      debounceMs: options.debounceMs ?? 80,
      lostAfterMs: options.lostAfterMs ?? 500,
      smoothing: options.smoothing ?? 0.45,
    };
  }

  get control(): HandControl { return { ...this.current }; }
  get calibrated(): boolean { return this.baseline !== null; }
  get baselineY(): number | null { return this.baseline; }
  get palm(): PalmPoint | null { return this.smooth ? { ...this.smooth } : null; }

  /** Keep the camera/model running, but never retain a held jump or duck while paused. */
  suspend(): void {
    this.current = neutral();
    this.smooth = null;
    this.lastSeen = null;
    this.firstFrame = null;
    this.laneCandidate = 0;
    this.pose = this.poseCandidate = 'neutral';
    if (!this.calibrated) {
      this.samples = [];
      this.calibrationStarted = null;
    }
  }

  recalibrate(): void {
    this.suspend();
    this.baseline = null;
    this.samples = [];
    this.calibrationStarted = null;
  }

  isLost(timestamp: number): boolean {
    const reference = this.lastSeen ?? this.firstFrame;
    return reference !== null && timestamp - reference >= this.options.lostAfterMs;
  }

  update(landmarks: readonly LandmarkPoint[] | null, timestamp: number): HandControl {
    if (!Number.isFinite(timestamp) || timestamp < this.lastTimestamp) return this.control;
    this.lastTimestamp = timestamp;
    this.firstFrame ??= timestamp;
    const palm = mirroredPalm(landmarks);
    if (!palm) {
      if (this.isLost(timestamp)) {
        this.current = neutral();
        this.smooth = null;
        this.laneCandidate = 0;
        this.pose = this.poseCandidate = 'neutral';
        // A partially collected calibration must not span a long hand absence.
        if (!this.calibrated) {
          this.samples = [];
          this.calibrationStarted = null;
        }
      }
      return this.control;
    }

    this.lastSeen = timestamp;
    const alpha = Math.max(0, Math.min(1, this.options.smoothing));
    this.smooth = this.smooth ? {
      x: this.smooth.x + alpha * (palm.x - this.smooth.x),
      y: this.smooth.y + alpha * (palm.y - this.smooth.y),
    } : palm;

    if (!this.calibrated) {
      this.calibrationStarted ??= timestamp;
      this.samples.push(palm.y);
      // Bound memory if video timestamps barely advance or frames arrive unusually fast.
      if (this.samples.length > 100) this.samples.shift();
      if (this.samples.length >= this.options.calibrationSamples &&
          timestamp - this.calibrationStarted >= this.options.calibrationMs) {
        this.baseline = median(this.samples);
      }
      this.current = { ...neutral(), visible: true };
      return this.control;
    }

    const { x, y } = this.smooth;
    let requestedLane: Lane;
    if (this.current.lane === -1 && x < 0.42) requestedLane = -1;
    else if (this.current.lane === 1 && x > 0.58) requestedLane = 1;
    else requestedLane = x < 0.36 ? -1 : x > 0.64 ? 1 : 0;
    if (requestedLane !== this.laneCandidate) {
      this.laneCandidate = requestedLane;
      this.laneCandidateSince = timestamp;
    }
    if (timestamp - this.laneCandidateSince >= this.options.debounceMs) {
      this.current.lane = this.laneCandidate;
    }

    const displacement = y - this.baseline!;
    let requestedPose: typeof this.pose = 'neutral';
    if (displacement < -0.14 || (this.pose === 'jump' && displacement < -0.08)) requestedPose = 'jump';
    else if (displacement > 0.14 || (this.pose === 'duck' && displacement > 0.08)) requestedPose = 'duck';
    if (requestedPose !== this.poseCandidate) {
      this.poseCandidate = requestedPose;
      this.poseCandidateSince = timestamp;
    }
    if (timestamp - this.poseCandidateSince >= this.options.debounceMs) this.pose = this.poseCandidate;
    this.current = {
      lane: this.current.lane,
      jump: this.pose === 'jump',
      duck: this.pose === 'duck',
      visible: true,
    };
    return this.control;
  }
}

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was denied. Allow camera access in your browser, then try again. Keyboard and touch controls remain available.';
  }
  if (name === 'NotFoundError') return 'No camera was found. Connect a camera, or use keyboard and touch controls.';
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera could not be opened. Close other apps using it, then try again.';
  }
  return error instanceof Error ? error.message : 'Hand tracking could not start. You can still use keyboard and touch controls.';
}

/** Explicitly started webcam input. Frames stay in this browser; inference is capped at 20 Hz. */
export class HandTracking {
  private readonly mapper = new HandControlMapper();
  private stream: MediaStream | null = null;
  private model: HandLandmarker | null = null;
  private request = 0;
  private generation = 0;
  private running = false;
  private enabled = true;
  private starting: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private nextDetectionAt = 0;
  private lastVideoTime = -1;
  private lastFreshFrameAt = 0;
  private stalled = false;
  private status: TrackingStatus = 'idle';
  private statusMessage = '';
  private delegate: 'GPU' | 'CPU' = 'GPU';
  private disposed = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly overlay: HTMLCanvasElement,
    private readonly callbacks: TrackingCallbacks = {},
    private readonly assetsBase: string = import.meta.env.BASE_URL,
  ) {
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get control(): HandControl { return this.mapper.control; }
  get active(): boolean { return this.running; }

  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Hand tracking has been disposed.'));
    if (this.running) return this.starting ?? Promise.resolve();
    const generation = ++this.generation;
    this.running = true;
    this.enabled = true;
    this.mapper.recalibrate();
    this.nextDetectionAt = 0;
    this.lastVideoTime = -1;
    this.abort = new AbortController();
    this.report('loading', 'Opening camera and loading the local hand-tracking model…');
    const pending = this.open(generation);
    this.starting = pending;
    void pending.finally(() => {
      if (this.generation === generation) this.starting = null;
    });
    return pending;
  }

  stop(): void {
    ++this.generation;
    this.running = false;
    this.starting = null;
    this.abort?.abort();
    this.abort = null;
    cancelAnimationFrame(this.request);
    this.request = 0;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.model?.close();
    this.model = null;
    this.mapper.recalibrate();
    this.clearOverlay();
    this.callbacks.onControl?.(this.control);
    this.report('idle', 'Camera is off. Keyboard and touch controls are available.');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.lastFreshFrameAt = performance.now();
    this.stalled = false;
    this.mapper.suspend();
    this.callbacks.onControl?.(this.control);
    if (this.running) {
      this.report(enabled ? 'calibrating' : 'paused', enabled
        ? this.mapper.calibrated ? 'Show your hand to resume tracking.' : 'Hold one hand at a comfortable neutral height for a moment.'
        : 'Hand input is paused.');
    }
  }

  calibrate(): void {
    this.mapper.recalibrate();
    this.lastFreshFrameAt = performance.now();
    this.stalled = false;
    this.callbacks.onControl?.(this.control);
    if (this.running) this.report('calibrating', 'Hold one hand at a comfortable neutral height for a moment.');
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden && this.running) {
      this.mapper.suspend();
      this.callbacks.onControl?.(this.control);
      this.report('paused', 'Tracking is paused while this page is hidden.');
    }
  };

  private report(status: TrackingStatus, message: string): void {
    if (status === this.status && message === this.statusMessage) return;
    this.status = status;
    this.statusMessage = message;
    this.callbacks.onStatus?.(status, message);
  }

  private asset(path: string): string {
    return `${this.assetsBase.replace(/\/?$/, '/')}${path}`;
  }

  private async open(generation: number): Promise<void> {
    const valid = (): boolean => this.running && this.generation === generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost in a browser with webcam support. Keyboard and touch controls are available.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        audio: false,
      });
      if (!valid()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          if (valid()) this.fail('The camera disconnected. Start the camera again, or use keyboard and touch controls.');
        }, { once: true });
      }
      this.video.srcObject = stream;
      await this.video.play();
      if (!valid()) return;
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      if (!valid()) return;
      const [vision, response] = await Promise.all([
        FilesetResolver.forVisionTasks(this.asset('mediapipe')),
        fetch(this.asset('models/hand_landmarker.task'), { signal: this.abort!.signal }),
      ]);
      if (!response.ok) throw new Error(`The local hand-tracking model could not be loaded (HTTP ${response.status}). Rebuild the app assets and try again.`);
      const modelAssetBuffer = new Uint8Array(await response.arrayBuffer());
      if (!valid()) return;
      const create = (delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> => HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer, delegate },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      let model: HandLandmarker;
      try {
        model = await create('GPU');
        this.delegate = 'GPU';
      } catch (gpuError) {
        if (!valid()) return;
        try { model = await create('CPU'); this.delegate = 'CPU'; }
        catch { throw new Error(`Hand-tracking initialization failed with GPU and CPU delegates. ${cameraErrorMessage(gpuError)}`); }
      }
      if (!valid()) { model.close(); return; }
      this.model = model;
      this.lastFreshFrameAt = performance.now();
      this.stalled = false;
      this.report('calibrating', `Hold one hand at a comfortable neutral height for a moment (${this.delegate}).`);
      this.request = requestAnimationFrame(this.frame);
    } catch (error) {
      if (valid()) this.fail(cameraErrorMessage(error));
    }
  }

  private fail(message: string): void {
    this.stop();
    this.report('error', message);
  }

  private readonly frame = (now: number): void => {
    if (!this.running || !this.model) return;
    this.request = requestAnimationFrame(this.frame);
    if (!this.enabled || document.hidden) return;
    if (now < this.nextDetectionAt) return;
    if (this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) {
      if (!this.stalled && now - this.lastFreshFrameAt >= 500) {
        this.stalled = true;
        // No fresh frames means there is no current hand evidence, even if the last
        // successful detection held an action. Hidden/disabled tracking is exempt.
        const control = this.mapper.update(null, now);
        this.draw(null);
        this.callbacks.onControl?.(control);
        this.report('nohand', 'Camera frames stopped. Check the camera, then resume when tracking returns.');
      }
      return;
    }
    this.lastVideoTime = this.video.currentTime;
    this.lastFreshFrameAt = now;
    this.stalled = false;
    try {
      // detectForVideo is synchronous: there can be no overlapping calls in this loop.
      const result = this.model.detectForVideo(this.video, now);
      const landmarks = result.landmarks[0] ?? null;
      const control = this.mapper.update(landmarks, now);
      this.draw(landmarks);
      this.callbacks.onControl?.(control);
      if (this.mapper.isLost(now)) this.report('nohand', 'Hand tracking was lost. Show your hand, then resume the game.');
      else if (!this.mapper.calibrated) this.report('calibrating', 'Hold one hand at a comfortable neutral height for a moment.');
      else if (landmarks) this.report('tracking', `Hand tracking ready (${this.delegate}). Move sideways to steer; raise your hand to jump, lower it to duck.`);
    } catch (error) {
      this.fail(`Hand tracking stopped: ${cameraErrorMessage(error)}`);
    } finally {
      // Slow synchronous inference must still leave time for browser input and
      // rendering. A start-to-start limit can otherwise consume every RAF.
      this.nextDetectionAt = performance.now() + 50;
    }
  };

  private clearOverlay(): void {
    const context = this.overlay.getContext('2d');
    context?.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  private draw(landmarks: readonly LandmarkPoint[] | null): void {
    const width = this.video.videoWidth || 640;
    const height = this.video.videoHeight || 480;
    if (this.overlay.width !== width) this.overlay.width = width;
    if (this.overlay.height !== height) this.overlay.height = height;
    const context = this.overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#ffffff66';
    context.lineWidth = 2;
    context.setLineDash([7, 7]);
    for (const x of [0.36, 0.64]) {
      context.beginPath(); context.moveTo(x * width, 0); context.lineTo(x * width, height); context.stroke();
    }
    if (this.mapper.baselineY !== null) {
      context.strokeStyle = '#ffc76e';
      context.beginPath();
      context.moveTo(0, this.mapper.baselineY * height);
      context.lineTo(width, this.mapper.baselineY * height);
      context.stroke();
    }
    context.setLineDash([]);
    if (!landmarks) return;
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
      [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
    ];
    context.strokeStyle = '#80e7c6';
    for (const [from, to] of connections) {
      context.beginPath();
      context.moveTo((1 - landmarks[from].x) * width, landmarks[from].y * height);
      context.lineTo((1 - landmarks[to].x) * width, landmarks[to].y * height);
      context.stroke();
    }
    context.fillStyle = '#ffffff';
    for (const point of landmarks) {
      context.beginPath();
      context.arc((1 - point.x) * width, point.y * height, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}
