/**
 * HOLOFLUX OMEGA — deterministic local universe generation. The same seed produces the same real configuration patch.
 */
import type { Formation, HoloConfig, UniverseMode } from "./holo-types";

const modes: UniverseMode[] = ["galaxy", "vortex", "blackhole", "supernova", "quantum", "fluid", "magnetic", "nebula", "dna", "neural", "planet", "dust"];
const formations: Formation[] = ["sphere", "heart", "galaxy", "spiral", "dna", "cube", "torus", "flower", "saturn", "infinity", "star", "wave"];
const palettes: Array<[string, string]> = [["#79F3FF", "#9C7BFF"], ["#FFE3B2", "#FF6565"], ["#8DFFB7", "#459BFF"], ["#F4AAFF", "#77E0FF"], ["#F8F2BA", "#4C63FF"], ["#FFB5DC", "#9A7BFF"]];

function numericSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function randomFor(seed: string) {
  let value = numericSeed(seed);
  return () => { value += 0x6d2b79f5; let result = value; result = Math.imul(result ^ (result >>> 15), result | 1); result ^= result + Math.imul(result ^ (result >>> 7), result | 61); return ((result ^ (result >>> 14)) >>> 0) / 4294967296; };
}
const range = (random: () => number, min: number, max: number) => min + (max - min) * random();

export function createUniverseSeed() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
  return `HF-${random.slice(0, 7)}`;
}

export function universeFromSeed(seed: string, base: HoloConfig): HoloConfig {
  const random = randomFor(seed);
  const mode = modes[Math.floor(random() * modes.length)];
  const formation = formations[Math.floor(random() * formations.length)];
  const palette = palettes[Math.floor(random() * palettes.length)];
  return {
    ...base,
    mode,
    formation,
    particles: { ...base.particles, size: range(random, 1.15, 3.35), density: range(random, 0.5, 1), randomness: range(random, 0.08, 0.92), trailLength: range(random, 0.22, 0.92) },
    physics: { ...base.physics, gravity: range(random, 0.08, 0.9), attraction: range(random, 0.5, 1.6), repulsion: range(random, 0.48, 1.55), turbulence: range(random, 0.06, 0.82), drag: range(random, 0.08, 0.58), viscosity: range(random, 0.05, 0.7), explosionPower: range(random, 0.7, 2.2), blackHoleStrength: range(random, 0.7, 2.25) },
    motion: { ...base.motion, rotation: range(random, 0.08, 1.1), orbitalSpeed: range(random, 0.25, 1.75), noise: range(random, 0.08, 0.92), flow: range(random, 0.08, 1.25), speed: range(random, 0.35, 1.9) },
    visuals: { ...base.visuals, colorA: palette[0], colorB: palette[1], colorStyle: random() > 0.7 ? "velocity" : "gradient", fog: range(random, 0.16, 0.78), glow: range(random, 0.55, 1.25) },
  };
}
