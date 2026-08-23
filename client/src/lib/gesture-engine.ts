/**
 * HOLOFLUX design reminder — Orbital Observatory: gesture recognition is smoothed, hysteretic, and maps raw motion to reusable physical intent.
 */
import type { GestureFrame, GestureName, HandPose, HoloConfig, TwoHandState, Vec2 } from "./holo-types";
import type { RawVisionHand } from "./vision-engine";

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

type PreviousHand = { position: Vec2; velocity: Vec2; rotation: number; gesture: GestureName; beganAt: number; pose: HandPose };

export class GestureEngine {
  private previous = new Map<string, PreviousHand>();
  private lastTime = performance.now();

  reset() { this.previous.clear(); }

  update(rawHands: RawVisionHand[], config: HoloConfig): GestureFrame {
    const now = performance.now();
    const dt = Math.max(0.016, Math.min(0.08, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const hands = rawHands.map((raw, index) => this.toPose(raw, index, config, dt, now));
    const currentIds = new Set(hands.map((hand) => hand.id));
    Array.from(this.previous.keys()).forEach((id) => { if (!currentIds.has(id)) this.previous.delete(id); });
    return { hands, twoHands: this.twoHands(hands) };
  }

  private toPose(raw: RawVisionHand, index: number, config: HoloConfig, dt: number, now: number): HandPose {
    // MediaPipe can transiently report the same handedness for both hands; include
    // frame order to keep React keys and force-field identifiers unique.
    const id = raw.handedness === "Unknown" ? `hand-${index}` : `${raw.handedness.toLowerCase()}-${index}`;
    const points = raw.landmarks.map((point) => ({ x: 1 - point.x, y: point.y }));
    const wrist = points[0] ?? { x: 0.5, y: 0.5 };
    const palm = points[9] ?? wrist;
    const position = points[8] ?? palm;
    const prev = this.previous.get(id);
    const smoothing = 0.18 + (1 - config.interaction.smoothing) * 0.44;
    const smoothedPosition = prev ? smoothVec(prev.position, position, smoothing) : position;
    const rawVelocity = prev ? { x: (smoothedPosition.x - prev.position.x) / dt, y: (smoothedPosition.y - prev.position.y) / dt } : { x: 0, y: 0 };
    const velocity = prev ? smoothVec(prev.velocity, rawVelocity, 0.38) : rawVelocity;
    const acceleration = prev ? { x: (velocity.x - prev.velocity.x) / dt, y: (velocity.y - prev.velocity.y) / dt } : { x: 0, y: 0 };
    const pinch = distance(points[4] ?? palm, points[8] ?? palm);
    const fingerExtended = (tip: number, pip: number) => distance(points[tip] ?? palm, wrist) > distance(points[pip] ?? palm, wrist) * 1.12;
    const extended = [fingerExtended(4, 3), fingerExtended(8, 6), fingerExtended(12, 10), fingerExtended(16, 14), fingerExtended(20, 18)];
    const count = extended.filter(Boolean).length;
    const openness = count / 5;
    let gesture: GestureName = "idle";
    const pinchOn = pinch < config.interaction.pinchThreshold;
    const pinchHold = prev?.gesture === "pinch" && pinch < config.interaction.pinchThreshold * 1.24;
    if (pinchOn || pinchHold) gesture = "pinch";
    else if (extended[1] && extended[2] && !extended[3] && !extended[4]) gesture = "two";
    else if (count >= 4) gesture = "palm";
    else if (extended[1]) gesture = "index";
    else if (count <= 1) gesture = "fist";
    const rotation = Math.atan2((points[8]?.y ?? palm.y) - wrist.y, (points[8]?.x ?? palm.x) - wrist.x);
    const duration = prev && prev.gesture === gesture ? (now - prev.beganAt) / 1000 : 0;
    const speed = Math.hypot(velocity.x, velocity.y);
    const pose: HandPose = {
      id,
      handedness: raw.handedness,
      position: smoothedPosition,
      wrist,
      palm,
      velocity,
      acceleration,
      pinch,
      openness,
      rotation,
      gesture,
      confidence: raw.score,
      duration,
      isSwipe: gesture === "index" && speed > 1.25,
      landmarkPoints: points,
    };
    this.previous.set(id, { position: smoothedPosition, velocity, rotation, gesture, beganAt: prev?.gesture === gesture ? prev.beganAt : now, pose });
    return pose;
  }

  private twoHands(hands: HandPose[]): TwoHandState | null {
    if (hands.length < 2) return null;
    const [a, b] = hands;
    const distanceBetween = distance(a.palm, b.palm);
    const lineAngle = Math.atan2(b.palm.y - a.palm.y, b.palm.x - a.palm.x);
    return {
      active: true,
      distance: distanceBetween,
      rotation: lineAngle,
      bothOpen: a.gesture === "palm" && b.gesture === "palm",
      bothPinched: a.gesture === "pinch" && b.gesture === "pinch",
      tunnel: (a.gesture === "palm" && b.gesture === "index") || (b.gesture === "palm" && a.gesture === "index"),
    };
  }
}
