/**
 * HOLOFLUX design reminder — Orbital Observatory: cinematic physical feedback, precise data models, and no decorative UI logic.
 */
export type Vec2 = { x: number; y: number };

export type GestureName = "idle" | "index" | "pinch" | "palm" | "fist" | "two";
export type GestureAction =
  | "attract"
  | "repel"
  | "gravity"
  | "blackhole"
  | "explosion"
  | "vortex"
  | "freeze"
  | "reset"
  | "spawnGalaxy"
  | "changeMode"
  | "changeColor"
  | "changeParticleCount"
  | "toggleTrails"
  | "screenshot"
  | "recording";

export type ForceType = "attract" | "repel" | "gravity" | "blackhole" | "vortex" | "explosion" | "freeze" | "tunnel";
export type UniverseMode = "galaxy" | "vortex" | "blackhole" | "supernova" | "quantum" | "fluid" | "magnetic" | "nebula" | "dna" | "neural" | "planet" | "dust";
export type Formation = "sphere" | "heart" | "galaxy" | "spiral" | "dna" | "cube" | "torus" | "flower" | "saturn" | "infinity" | "star" | "wave" | "text";
export type CollisionMode = "bounce" | "merge" | "explode" | "elastic" | "soft";

export interface ForceField {
  id: string;
  type: ForceType;
  position: Vec2;
  strength: number;
  radius: number;
  velocity?: Vec2;
  rotation?: number;
  expiresAt?: number;
  label?: string;
}

export interface HandPose {
  id: string;
  handedness: "Left" | "Right" | "Unknown";
  position: Vec2;
  wrist: Vec2;
  palm: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  pinch: number;
  openness: number;
  rotation: number;
  gesture: GestureName;
  confidence: number;
  duration: number;
  isSwipe: boolean;
  landmarkPoints: Vec2[];
}

export interface TwoHandState {
  active: boolean;
  distance: number;
  rotation: number;
  bothOpen: boolean;
  bothPinched: boolean;
  tunnel: boolean;
}

export interface GestureFrame {
  hands: HandPose[];
  twoHands: TwoHandState | null;
}

export interface HoloConfig {
  mode: UniverseMode;
  formation: Formation;
  customText: string;
  particles: {
    count: number;
    size: number;
    opacity: number;
    lifetime: number;
    randomness: number;
    density: number;
    trailLength: number;
  };
  physics: {
    gravity: number;
    attraction: number;
    repulsion: number;
    turbulence: number;
    drag: number;
    viscosity: number;
    collisionStrength: number;
    explosionPower: number;
    blackHoleStrength: number;
  };
  motion: {
    rotation: number;
    orbitalSpeed: number;
    noise: number;
    flow: number;
    speed: number;
  };
  visuals: {
    backgroundIntensity: number;
    bloom: number;
    glow: number;
    trails: boolean;
    starDensity: number;
    fog: number;
    depth: number;
    cameraShake: boolean;
    colorStyle: "single" | "gradient" | "rainbow" | "velocity" | "random" | "palette";
    colorA: string;
    colorB: string;
    audioReactive: boolean;
  };
  interaction: {
    pinchThreshold: number;
    forceStrength: number;
    smoothing: number;
    trackingConfidence: number;
    radius: number;
    dominantHand: "auto" | "left" | "right";
    gestureMap: Record<GestureName, GestureAction>;
  };
  collisionMode: CollisionMode;
  collisionEnergy: number;
  shockwave: boolean;
  fragmentation: boolean;
  performanceMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface Preset {
  id: string;
  name: string;
  shortcut?: number;
  config: Partial<HoloConfig>;
  builtIn?: boolean;
}

export interface Metrics {
  fps: number;
  frameTime: number;
  particleCount: number;
  trackingLatency: number;
  adaptiveLevel: "cinematic" | "balanced" | "performance";
}

export interface ParticleFieldHandle {
  reset: () => void;
  focus: (position: Vec2) => void;
  getCanvas: () => HTMLCanvasElement | null;
}
