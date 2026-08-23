/**
 * HOLOFLUX design reminder — Orbital Observatory: presets alter real simulation parameters, never only presentation state.
 */
import type { HoloConfig, Preset } from "./holo-types";

export const DEFAULT_CONFIG: HoloConfig = {
  mode: "galaxy",
  formation: "galaxy",
  customText: "ATHARV",
  particles: { count: 7200, size: 2.1, opacity: 0.92, lifetime: 0.8, randomness: 0.42, density: 0.7, trailLength: 0.52 },
  physics: { gravity: 0.22, attraction: 0.78, repulsion: 0.84, turbulence: 0.18, drag: 0.22, viscosity: 0.16, collisionStrength: 0.74, explosionPower: 1.05, blackHoleStrength: 1.2 },
  motion: { rotation: 0.34, orbitalSpeed: 0.7, noise: 0.22, flow: 0.38, speed: 1 },
  visuals: { backgroundIntensity: 0.82, bloom: 0.8, glow: 0.9, trails: true, starDensity: 0.4, fog: 0.35, depth: 0.7, cameraShake: true, colorStyle: "gradient", colorA: "#79F3FF", colorB: "#9C7BFF", audioReactive: false },
  interaction: {
    pinchThreshold: 0.062,
    forceStrength: 0.86,
    smoothing: 0.62,
    trackingConfidence: 0.55,
    radius: 0.21,
    dominantHand: "auto",
    gestureMap: { idle: "attract", index: "attract", pinch: "gravity", palm: "repel", fist: "blackhole", two: "freeze" },
  },
  brush: { mode: "draw", size: 0.18, density: 0.58, lifetime: 0.72, mass: 0.5 },
  camera: { mode: "free", fov: 44, drift: 0.35 },
  collisionMode: "elastic",
  collisionEnergy: 72,
  shockwave: true,
  fragmentation: true,
  performanceMode: false,
  qualityTier: "balanced",
  reducedMotion: false,
  highContrast: false,
};

const withConfig = (patch: Partial<HoloConfig>): Partial<HoloConfig> => patch;

export const BUILT_IN_PRESETS: Preset[] = [
  { id: "black-hole", name: "Black Hole", shortcut: 1, builtIn: true, config: withConfig({ mode: "blackhole", formation: "spiral", physics: { ...DEFAULT_CONFIG.physics, gravity: 0.64, blackHoleStrength: 2.1, turbulence: 0.08 }, motion: { ...DEFAULT_CONFIG.motion, orbitalSpeed: 1.4 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#A8CFFF", colorB: "#32206B", bloom: 1.15 } }) },
  { id: "supernova", name: "Supernova", shortcut: 2, builtIn: true, config: withConfig({ mode: "supernova", formation: "star", physics: { ...DEFAULT_CONFIG.physics, explosionPower: 2.2, turbulence: 0.58, repulsion: 1.2 }, motion: { ...DEFAULT_CONFIG.motion, speed: 1.45 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#FFE5B0", colorB: "#FF6363", glow: 1.25 } }) },
  { id: "galaxy", name: "Galaxy", shortcut: 3, builtIn: true, config: withConfig({ mode: "galaxy", formation: "galaxy", physics: { ...DEFAULT_CONFIG.physics, gravity: 0.29 }, motion: { ...DEFAULT_CONFIG.motion, rotation: 0.48, orbitalSpeed: 0.88 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#79F3FF", colorB: "#9C7BFF" } }) },
  { id: "quantum", name: "Quantum", shortcut: 4, builtIn: true, config: withConfig({ mode: "quantum", formation: "sphere", particles: { ...DEFAULT_CONFIG.particles, count: 9200, size: 1.5, randomness: 0.88 }, physics: { ...DEFAULT_CONFIG.physics, turbulence: 0.8, drag: 0.1 }, motion: { ...DEFAULT_CONFIG.motion, speed: 1.7 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#C8FFB8", colorB: "#68B7FF", colorStyle: "velocity" } }) },
  { id: "nebula", name: "Nebula", shortcut: 5, builtIn: true, config: withConfig({ mode: "nebula", formation: "flower", particles: { ...DEFAULT_CONFIG.particles, size: 3.25, opacity: 0.58 }, physics: { ...DEFAULT_CONFIG.physics, turbulence: 0.28, drag: 0.44 }, motion: { ...DEFAULT_CONFIG.motion, speed: 0.46 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#F0A5FF", colorB: "#78D9FF", fog: 0.72, trails: true } }) },
  { id: "matrix", name: "Matrix", shortcut: 6, builtIn: true, config: withConfig({ mode: "neural", formation: "wave", particles: { ...DEFAULT_CONFIG.particles, count: 8200, size: 1.35 }, physics: { ...DEFAULT_CONFIG.physics, gravity: 0.06, drag: 0.12 }, motion: { ...DEFAULT_CONFIG.motion, flow: 1.1, speed: 1.08 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#8FFF9A", colorB: "#37C8A0", colorStyle: "single" } }) },
  { id: "aurora", name: "Aurora", shortcut: 7, builtIn: true, config: withConfig({ mode: "fluid", formation: "wave", particles: { ...DEFAULT_CONFIG.particles, size: 2.6 }, physics: { ...DEFAULT_CONFIG.physics, turbulence: 0.42, viscosity: 0.52 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#65F4D8", colorB: "#B487FF", colorStyle: "gradient" } }) },
  { id: "cosmic-ocean", name: "Cosmic Ocean", shortcut: 8, builtIn: true, config: withConfig({ mode: "fluid", formation: "torus", particles: { ...DEFAULT_CONFIG.particles, count: 9000, size: 2.8 }, physics: { ...DEFAULT_CONFIG.physics, gravity: 0.12, viscosity: 0.78 }, motion: { ...DEFAULT_CONFIG.motion, flow: 0.88, speed: 0.62 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#73D3FF", colorB: "#0B4A9B", fog: 0.6 } }) },
  { id: "dna", name: "DNA", shortcut: 9, builtIn: true, config: withConfig({ mode: "dna", formation: "dna", particles: { ...DEFAULT_CONFIG.particles, count: 6400, size: 1.8 }, physics: { ...DEFAULT_CONFIG.physics, turbulence: 0.08, drag: 0.42 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#82E8FF", colorB: "#FF7FB8" } }) },
  { id: "heart", name: "Heart", builtIn: true, config: withConfig({ mode: "nebula", formation: "heart", particles: { ...DEFAULT_CONFIG.particles, count: 7400, size: 2.45 }, physics: { ...DEFAULT_CONFIG.physics, drag: 0.35 }, visuals: { ...DEFAULT_CONFIG.visuals, colorA: "#FFE1E8", colorB: "#FF4F7A" } }) },
];

export function mergeConfig(base: HoloConfig, patch: Partial<HoloConfig>): HoloConfig {
  return {
    ...base,
    ...patch,
    particles: { ...base.particles, ...(patch.particles ?? {}) },
    physics: { ...base.physics, ...(patch.physics ?? {}) },
    motion: { ...base.motion, ...(patch.motion ?? {}) },
    visuals: { ...base.visuals, ...(patch.visuals ?? {}) },
    interaction: { ...base.interaction, ...(patch.interaction ?? {}), gestureMap: { ...base.interaction.gestureMap, ...(patch.interaction?.gestureMap ?? {}) } },
    brush: { ...base.brush, ...(patch.brush ?? {}) },
    camera: { ...base.camera, ...(patch.camera ?? {}) },
  };
}
