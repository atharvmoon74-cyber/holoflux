/**
 * HOLOFLUX design reminder — tests protect the local, reusable gesture-to-force interpreter.
 */
import { describe, expect, it } from "vitest";
import { GestureEngine } from "./gesture-engine";
import { DEFAULT_CONFIG, mergeConfig } from "./presets";
import { profileFor } from "./performance-profile";
import type { RawVisionHand } from "./vision-engine";

type Point = { x: number; y: number; z: number };

function rawWithExtended(extended: number[], pinch = false): RawVisionHand {
  const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.62, z: 0 }));
  points[0] = { x: 0.5, y: 0.82, z: 0 };
  points[9] = { x: 0.5, y: 0.57, z: 0 };
  const pairs: Array<[number, number]> = [[4, 3], [8, 6], [12, 10], [16, 14], [20, 18]];
  pairs.forEach(([tip, pip], index) => {
    points[pip] = { x: 0.5 + index * 0.018, y: 0.58, z: 0 };
    points[tip] = { x: 0.5 + index * 0.018, y: extended.includes(index) ? 0.2 : 0.66, z: 0 };
  });
  points[3] = { x: 0.39, y: 0.58, z: 0 };
  points[4] = { x: 0.3, y: extended.includes(0) ? 0.2 : 0.66, z: 0 };
  if (pinch) points[4] = { ...points[8] };
  return { landmarks: points, handedness: "Right", score: 0.94 };
}

describe("GestureEngine", () => {
  it("recognizes the default index, palm, fist, pinch, and two-finger patterns", () => {
    const engine = new GestureEngine();
    expect(engine.update([rawWithExtended([1])], DEFAULT_CONFIG).hands[0].gesture).toBe("index");
    expect(engine.update([rawWithExtended([0, 1, 2, 3, 4])], DEFAULT_CONFIG).hands[0].gesture).toBe("palm");
    expect(engine.update([rawWithExtended([])], DEFAULT_CONFIG).hands[0].gesture).toBe("fist");
    expect(engine.update([rawWithExtended([1], true)], DEFAULT_CONFIG).hands[0].gesture).toBe("pinch");
    expect(engine.update([rawWithExtended([1, 2])], DEFAULT_CONFIG).hands[0].gesture).toBe("two");
  });

  it("describes a two-hand relationship rather than a second cursor", () => {
    const engine = new GestureEngine();
    const frame = engine.update([rawWithExtended([0, 1, 2, 3, 4]), { ...rawWithExtended([0, 1, 2, 3, 4]), handedness: "Left" }], DEFAULT_CONFIG);
    expect(frame.twoHands?.active).toBe(true);
    expect(frame.twoHands?.bothOpen).toBe(true);
  });

  it("assigns unique IDs when vision briefly labels both detected hands alike", () => {
    const engine = new GestureEngine();
    const frame = engine.update([rawWithExtended([1]), rawWithExtended([1])], DEFAULT_CONFIG);
    expect(new Set(frame.hands.map((hand) => hand.id)).size).toBe(2);
  });

  it("keeps a raw fingertip sample while predicting short-term movement for an immediate force response", () => {
    const engine = new GestureEngine();
    const first = rawWithExtended([1]);
    first.landmarks[8].x = 0.62;
    engine.update([first], DEFAULT_CONFIG);
    const second = rawWithExtended([1]);
    second.landmarks[8].x = 0.46;
    const frame = engine.update([second], DEFAULT_CONFIG);
    expect(frame.hands[0].rawPosition.x).not.toBe(frame.hands[0].predictedPosition.x);
    expect(frame.hands[0].forceMultiplier).toBeGreaterThan(1);
  });
});

describe("mergeConfig", () => {
  it("retains nested simulation configuration while applying a preset patch", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { physics: { ...DEFAULT_CONFIG.physics, gravity: 1.1 } });
    expect(merged.physics.gravity).toBe(1.1);
    expect(merged.particles.count).toBe(DEFAULT_CONFIG.particles.count);
  });
});

describe("quality profiles", () => {
  it("declares genuine tier budgets spanning eco through extreme", () => {
    expect(profileFor("eco").total).toBeGreaterThanOrEqual(10000);
    expect(profileFor("ultra").total).toBeGreaterThanOrEqual(100000);
    expect(profileFor("extreme").total).toBeGreaterThanOrEqual(200000);
  });
});
