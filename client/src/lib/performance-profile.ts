/**
 * HOLOFLUX Ultra — hardware-aware particle budgets split an interactive typed-array field from GPU-simulated depth layers.
 */
import type { QualityTier } from "./holo-types";

export type QualityProfile = {
  tier: Exclude<QualityTier, "custom">;
  label: string;
  total: number;
  interactive: number;
  depth: number;
  collisionStride: number;
  trackingInterval: number;
  maxPixelRatio: number;
};

export const QUALITY_PROFILES: Record<Exclude<QualityTier, "custom">, QualityProfile> = {
  eco: { tier: "eco", label: "ECO", total: 12000, interactive: 5000, depth: 7000, collisionStride: 10, trackingInterval: 42, maxPixelRatio: 1.2 },
  balanced: { tier: "balanced", label: "BALANCED", total: 30000, interactive: 9000, depth: 21000, collisionStride: 7, trackingInterval: 34, maxPixelRatio: 1.45 },
  high: { tier: "high", label: "HIGH", total: 60000, interactive: 15000, depth: 45000, collisionStride: 5, trackingInterval: 30, maxPixelRatio: 1.65 },
  ultra: { tier: "ultra", label: "ULTRA", total: 120000, interactive: 20000, depth: 100000, collisionStride: 4, trackingInterval: 28, maxPixelRatio: 1.8 },
  extreme: { tier: "extreme", label: "EXTREME", total: 220000, interactive: 25000, depth: 195000, collisionStride: 3, trackingInterval: 26, maxPixelRatio: 1.9 },
};

export function detectInitialQuality(): Exclude<QualityTier, "custom"> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile || cores <= 4 || memory <= 4) return "eco";
  if (cores >= 12 && memory >= 16) return "ultra";
  if (cores >= 8 && memory >= 8) return "high";
  return "balanced";
}

export function profileFor(tier: QualityTier): QualityProfile {
  return QUALITY_PROFILES[tier === "custom" ? "balanced" : tier];
}
