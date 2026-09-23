export const APP_CONFIG = {
  gestureHoldMs: 480,
  lockHoldMs: 680,
  gestureCooldownMs: 850,
  selectionCooldownMs: 120,
  lockDropoutGraceMs: 220,
  maxHoldFrameDeltaMs: 95,
  // ~18 inference FPS is ample for gestures held for 480–680 ms, while
  // substantially reducing CPU/GPU load compared with ~30 FPS.
  inferenceIntervalMs: 55,
  // Skeleton is visual feedback only, so it is drawn at ~12 FPS.
  skeletonDrawIntervalMs: 84,
  handLostCancelMs: 650,
  cursorSmoothing: 0.46,
  camera: {
    width: 960,
    height: 540,
    frameRate: 24,
    maxFrameRate: 30
  },
  fist: {
    engageScore: 0.52,
    releaseScore: 0.36,
    debounceMs: 80
  },
  pinch: {
    engageRatio: 0.38,
    releaseRatio: 0.52,
    debounceMs: 65
  },
  scoring: {
    correct: 100,
    fastestBonus: 25,
    matchPair: 50,
    matchPerfectBonus: 50,
    sequenceCorrectPosition: 40,
    sequencePerfectBonus: 40,
    multiCorrectPick: 50,
    multiWrongPick: -25,
    multiPerfectBonus: 50
  },
  mediapipe: {
    wasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
    modelUrl: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  }
} as const;
