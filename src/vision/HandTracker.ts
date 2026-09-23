import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { APP_CONFIG } from "../config";
import type { HandFrame, PlayerId, Point } from "../types";
import { clamp, distance } from "../utils/dom";

interface NormalizedPoint {
  x: number;
  y: number;
  z?: number;
}

interface ResultLike {
  landmarks?: NormalizedPoint[][];
}

interface BinaryGestureMemory {
  stable: boolean;
  candidate: boolean;
  candidateSince: number;
}

interface StageGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}

type PinchMemory = BinaryGestureMemory;
type FistMemory = BinaryGestureMemory;

export interface HandTrackerCallbacks {
  onFrames: (frames: Map<PlayerId, HandFrame>) => void;
  onStatus: (message: string) => void;
  onError: (message: string, error?: unknown) => void;
}

const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

export class HandTracker {
  private readonly video: HTMLVideoElement;
  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: HandTrackerCallbacks;
  private handLandmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private processingEnabled = true;
  private lastInferenceAt = 0;
  private lastDrawAt = 0;
  private lastVideoTime = -1;
  private smoothCursor: Partial<Record<PlayerId, Point>> = {};
  private pinchMemory: Record<PlayerId, PinchMemory> = {
    1: { stable: false, candidate: false, candidateSince: 0 },
    2: { stable: false, candidate: false, candidateSince: 0 }
  };
  private fistMemory: Record<PlayerId, FistMemory> = {
    1: { stable: false, candidate: false, candidateSince: 0 },
    2: { stable: false, candidate: false, candidateSince: 0 }
  };

  constructor(
    video: HTMLVideoElement,
    stage: HTMLElement,
    canvas: HTMLCanvasElement,
    callbacks: HandTrackerCallbacks
  ) {
    this.video = video;
    this.stage = stage;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D tidak tersedia.");
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  async initialize(): Promise<void> {
    this.callbacks.onStatus("Memuat MediaPipe…");
    const vision = await FilesetResolver.forVisionTasks(APP_CONFIG.mediapipe.wasmRoot);

    const options = {
      baseOptions: {
        modelAssetPath: APP_CONFIG.mediapipe.modelUrl,
        delegate: "GPU" as const
      },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    };

    try {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, options);
      this.callbacks.onStatus("MediaPipe siap (GPU). Mode hemat performa aktif.");
    } catch (gpuError) {
      this.callbacks.onStatus("GPU tidak tersedia, mencoba CPU…");
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: APP_CONFIG.mediapipe.modelUrl,
          delegate: "CPU" as const
        }
      });
      this.callbacks.onStatus("MediaPipe siap (CPU). Mode hemat performa aktif.");
      console.warn("MediaPipe GPU fallback:", gpuError);
    }
  }

  async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses kamera. Gunakan Chrome/Edge modern melalui HTTPS atau localhost.");
    }
    if (!this.handLandmarker) await this.initialize();

    this.callbacks.onStatus("Meminta izin kamera…");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: APP_CONFIG.camera.width },
        height: { ideal: APP_CONFIG.camera.height },
        frameRate: { ideal: APP_CONFIG.camera.frameRate, max: APP_CONFIG.camera.maxFrameRate }
      }
    });

    this.video.srcObject = this.stream;
    await new Promise<void>((resolve) => {
      if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
      this.video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
    await this.video.play();

    this.running = true;
    this.callbacks.onStatus("Kamera aktif. Analisis gesture dioptimalkan agar lebih ringan.");
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas, { passive: true });
    this.loop();
  }

  setProcessingEnabled(enabled: boolean): void {
    if (this.processingEnabled === enabled) return;
    this.processingEnabled = enabled;
    this.lastInferenceAt = 0;
    this.lastVideoTime = -1;
    if (!enabled) {
      this.clearCanvas();
      this.smoothCursor = {};
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.resizeCanvas);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.clearCanvas();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    // Keep the video preview alive while completely skipping expensive inference
    // during start/chapter/result overlays.
    if (!this.processingEnabled) return;
    if (!this.handLandmarker || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const now = performance.now();
    if (now - this.lastInferenceAt < APP_CONFIG.inferenceIntervalMs) return;
    if (this.video.currentTime === this.lastVideoTime) return;

    this.lastInferenceAt = now;
    this.lastVideoTime = this.video.currentTime;

    try {
      const raw = this.handLandmarker.detectForVideo(this.video, now) as unknown as ResultLike;
      const geometry = this.measureStage();
      const frames = this.process(raw.landmarks ?? [], now, geometry);
      if (now - this.lastDrawAt >= APP_CONFIG.skeletonDrawIntervalMs) {
        this.lastDrawAt = now;
        this.draw(frames, geometry);
      }
      this.callbacks.onFrames(frames);
    } catch (error) {
      this.callbacks.onError("Terjadi kesalahan saat membaca frame MediaPipe.", error);
    }
  };

  private process(hands: NormalizedPoint[][], now: number, geometry: StageGeometry): Map<PlayerId, HandFrame> {
    // Important performance optimization: stage geometry is measured ONCE per
    // inference, then reused for all 21 landmarks × up to 2 hands.
    const candidates = hands
      .filter((landmarks) => landmarks.length >= 21)
      .map((landmarks) => {
        const mapped = landmarks.map((landmark) => this.normalizedToClient(landmark, geometry));
        return { landmarks, mapped, cursor: mapped[8]! };
      })
      .sort((a, b) => a.cursor.x - b.cursor.x);

    const assigned = new Map<PlayerId, (typeof candidates)[number]>();
    if (candidates.length >= 2) {
      assigned.set(1, candidates[0]!);
      assigned.set(2, candidates[candidates.length - 1]!);
    } else if (candidates.length === 1) {
      const only = candidates[0]!;
      const center = geometry.left + geometry.width / 2;
      assigned.set(only.cursor.x < center ? 1 : 2, only);
    }

    const frames = new Map<PlayerId, HandFrame>();
    ([1, 2] as const).forEach((playerId) => {
      const hand = assigned.get(playerId);
      if (!hand) return;

      const previous = this.smoothCursor[playerId];
      const alpha = APP_CONFIG.cursorSmoothing;
      const cursor = previous
        ? {
            x: previous.x + (hand.cursor.x - previous.x) * alpha,
            y: previous.y + (hand.cursor.y - previous.y) * alpha
          }
        : hand.cursor;
      this.smoothCursor[playerId] = cursor;

      const thumb = hand.landmarks[4]!;
      const index = hand.landmarks[8]!;
      const wrist = hand.landmarks[0]!;
      const middleMcp = hand.landmarks[9]!;
      const handScale = Math.max(0.02, distance(wrist, middleMcp));
      const pinchRatio = distance(thumb, index) / handScale;
      const pinch = this.updatePinch(playerId, pinchRatio, now);
      const fistScore = this.closedFistScore(hand.landmarks);
      const fist = this.updateFist(playerId, fistScore, now);

      frames.set(playerId, {
        playerId,
        cursor,
        pinch,
        pinchRatio,
        fist,
        fistScore,
        landmarks: hand.mapped,
        seenAt: now
      });
    });

    return frames;
  }

  private updatePinch(playerId: PlayerId, ratio: number, now: number): boolean {
    const memory = this.pinchMemory[playerId];
    const rawCandidate = memory.stable
      ? ratio < APP_CONFIG.pinch.releaseRatio
      : ratio < APP_CONFIG.pinch.engageRatio;
    if (rawCandidate !== memory.candidate) {
      memory.candidate = rawCandidate;
      memory.candidateSince = now;
    }
    if (memory.stable !== memory.candidate && now - memory.candidateSince >= APP_CONFIG.pinch.debounceMs) {
      memory.stable = memory.candidate;
    }
    return memory.stable;
  }

  private updateFist(playerId: PlayerId, score: number, now: number): boolean {
    const memory = this.fistMemory[playerId];
    const rawCandidate = memory.stable
      ? score >= APP_CONFIG.fist.releaseScore
      : score >= APP_CONFIG.fist.engageScore;
    if (rawCandidate !== memory.candidate) {
      memory.candidate = rawCandidate;
      memory.candidateSince = now;
    }
    if (memory.stable !== memory.candidate && now - memory.candidateSince >= APP_CONFIG.fist.debounceMs) {
      memory.stable = memory.candidate;
    }
    return memory.stable;
  }

  private closedFistScore(points: NormalizedPoint[]): number {
    const wrist = points[0];
    if (!wrist) return 0;
    const fingers = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]] as const;
    let total = 0;
    let strongExtended = 0;
    for (const [mcpIndex, pipIndex, tipIndex] of fingers) {
      const mcp = points[mcpIndex];
      const pip = points[pipIndex];
      const tip = points[tipIndex];
      if (!mcp || !pip || !tip) continue;
      const angle = this.angleDeg(mcp, pip, tip);
      const angleCurl = clamp((155 - angle) / 55, 0, 1);
      const pipDistance = Math.max(0.0001, distance(wrist, pip));
      const foldRatio = distance(wrist, tip) / pipDistance;
      const foldCurl = clamp((1.12 - foldRatio) / 0.34, 0, 1);
      total += angleCurl * 0.72 + foldCurl * 0.28;
      if (angle > 158 && foldRatio > 1.06) strongExtended += 1;
    }
    let score = total / 4;
    if (strongExtended >= 1) score *= 0.22;
    return clamp(score, 0, 1);
  }

  private angleDeg(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint): number {
    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const dot = v1x * v2x + v1y * v2y;
    const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (!mag) return 0;
    return Math.acos(clamp(dot / mag, -1, 1)) * 180 / Math.PI;
  }

  private measureStage(): StageGeometry {
    const rect = this.stage.getBoundingClientRect();
    const videoWidth = this.video.videoWidth || rect.width;
    const videoHeight = this.video.videoHeight || rect.height;
    const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      renderedWidth,
      renderedHeight,
      offsetX: (rect.width - renderedWidth) / 2,
      offsetY: (rect.height - renderedHeight) / 2
    };
  }

  private normalizedToClient(point: NormalizedPoint, geometry: StageGeometry): Point {
    const unmirroredLocalX = point.x * geometry.renderedWidth + geometry.offsetX;
    const localX = geometry.width - unmirroredLocalX;
    const localY = point.y * geometry.renderedHeight + geometry.offsetY;
    return {
      x: clamp(geometry.left + localX, geometry.left, geometry.right),
      y: clamp(geometry.top + localY, geometry.top, geometry.bottom)
    };
  }

  private draw(frames: Map<PlayerId, HandFrame>, geometry: StageGeometry): void {
    this.ctx.clearRect(0, 0, geometry.width, geometry.height);
    frames.forEach((frame) => {
      const color = frame.playerId === 1 ? "#6ee7ff" : "#f7a8ff";
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.9;
      for (const [a, b] of CONNECTIONS) {
        const pa = frame.landmarks[a];
        const pb = frame.landmarks[b];
        if (!pa || !pb) continue;
        this.ctx.beginPath();
        this.ctx.moveTo(pa.x - geometry.left, pa.y - geometry.top);
        this.ctx.lineTo(pb.x - geometry.left, pb.y - geometry.top);
        this.ctx.stroke();
      }
      frame.landmarks.forEach((point, index) => {
        this.ctx.beginPath();
        this.ctx.arc(point.x - geometry.left, point.y - geometry.top, index === 8 || index === 4 ? 4 : 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });
    this.ctx.globalAlpha = 1;
  }

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resizeCanvas = (): void => {
    const rect = this.stage.getBoundingClientRect();
    // Do not use devicePixelRatio here: a full-resolution Retina canvas can be
    // needlessly expensive for a decorative skeleton overlay.
    this.canvas.width = Math.max(1, Math.round(rect.width));
    this.canvas.height = Math.max(1, Math.round(rect.height));
  };
}
