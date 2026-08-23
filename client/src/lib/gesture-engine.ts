/**
 * HOLOFLUX Ultra — raw landmark position is separated from gesture classification so force fields stay direct, predictive, and low-latency.
 */
import type { GestureFrame, GestureName, HandPose, HoloConfig, TwoHandState, Vec2 } from "./holo-types";
import type { RawVisionHand } from "./vision-engine";

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type PreviousHand = {
  rawPosition: Vec2;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  rotation: number;
  gesture: GestureName;
  beganAt: number;
};

export class GestureEngine {
  private previous = new Map<string, PreviousHand>();
  private lastTime = performance.now();
  private previousTwo: { distance: number; rotation: number } | null = null;

  reset() { this.previous.clear(); this.previousTwo = null; }

  update(rawHands: RawVisionHand[], config: HoloConfig): GestureFrame {
    const now = performance.now();
    const dt = Math.max(0.012, Math.min(0.085, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const hands = rawHands.map((raw, index) => this.toPose(raw, index, config, dt, now));
    const currentIds = new Set(hands.map((hand) => hand.id));
    Array.from(this.previous.keys()).forEach((id) => { if (!currentIds.has(id)) this.previous.delete(id); });
    return { hands, twoHands: this.twoHands(hands, dt) };
  }

  private toPose(raw: RawVisionHand, index: number, config: HoloConfig, dt: number, now: number): HandPose {
    // Vision libraries can emit duplicate handedness; the index keeps renderer/force IDs unique inside a frame.
    const id = raw.handedness === "Unknown" ? `hand-${index}` : `${raw.handedness.toLowerCase()}-${index}`;
    const points = raw.landmarks.map((point) => ({ x: 1 - point.x, y: point.y }));
    const wrist = points[0] ?? { x: 0.5, y: 0.5 };
    const palm = points[9] ?? wrist;
    const rawPosition = points[8] ?? palm;
    const prev = this.previous.get(id);
    const rawVelocity = prev ? { x: (rawPosition.x - prev.rawPosition.x) / dt, y: (rawPosition.y - prev.rawPosition.y) / dt } : { x: 0, y: 0 };
    const rawSpeed = Math.hypot(rawVelocity.x, rawVelocity.y);
    // Fast motion deliberately gets less smoothing; slow motion gets stable landmark suppression.
    const response = clamp(0.26 + (1 - config.interaction.smoothing) * 0.33 + Math.min(rawSpeed, 2.6) * 0.12, 0.24, 0.92);
    const position = prev ? smoothVec(prev.position, rawPosition, response) : rawPosition;
    const velocity = prev ? smoothVec(prev.velocity, rawVelocity, clamp(0.42 + rawSpeed * 0.1, 0.42, 0.84)) : rawVelocity;
    const acceleration = prev ? { x: (velocity.x - prev.velocity.x) / dt, y: (velocity.y - prev.velocity.y) / dt } : { x: 0, y: 0 };
    // 18–38ms extrapolation masks tracking latency without unstable long-range prediction.
    const lead = clamp(0.018 + rawSpeed * 0.008, 0.018, 0.038);
    const predictedPosition = { x: clamp(position.x + velocity.x * lead, 0, 1), y: clamp(position.y + velocity.y * lead, 0, 1) };
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
    const rotationDelta = prev ? Math.atan2(Math.sin(rotation - prev.rotation), Math.cos(rotation - prev.rotation)) : 0;
    const angularVelocity = rotationDelta / dt;
    const duration = prev && prev.gesture === gesture ? (now - prev.beganAt) / 1000 : 0;
    const accelerationMagnitude = Math.hypot(acceleration.x, acceleration.y);
    const forceMultiplier = clamp(1 + rawSpeed * 0.34 + accelerationMagnitude * 0.012, 1, 3.3);
    const pose: HandPose = {
      id,
      handedness: raw.handedness,
      position,
      rawPosition,
      predictedPosition,
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
      isSwipe: gesture === "index" && rawSpeed > 1.18,
      isCircular: (gesture === "index" || gesture === "pinch") && rawSpeed > 0.48 && Math.abs(angularVelocity) > 2.25,
      pinchReleased: prev?.gesture === "pinch" && gesture !== "pinch" && rawSpeed > 0.62,
      speed: rawSpeed,
      forceMultiplier,
      landmarkPoints: points,
    };
    this.previous.set(id, { rawPosition, position, velocity, acceleration, rotation, gesture, beganAt: prev?.gesture === gesture ? prev.beganAt : now });
    return pose;
  }

  private twoHands(hands: HandPose[], dt: number): TwoHandState | null {
    if (hands.length < 2) { this.previousTwo = null; return null; }
    const [a, b] = hands;
    const distanceBetween = distance(a.palm, b.palm);
    const rotation = Math.atan2(b.palm.y - a.palm.y, b.palm.x - a.palm.x);
    const previous = this.previousTwo;
    const distanceVelocity = previous ? (distanceBetween - previous.distance) / dt : 0;
    const rotationDelta = previous ? Math.atan2(Math.sin(rotation - previous.rotation), Math.cos(rotation - previous.rotation)) : 0;
    const rotationVelocity = rotationDelta / dt;
    this.previousTwo = { distance: distanceBetween, rotation };
    return {
      active: true,
      distance: distanceBetween,
      rotation,
      bothOpen: a.gesture === "palm" && b.gesture === "palm",
      bothPinched: a.gesture === "pinch" && b.gesture === "pinch",
      tunnel: (a.gesture === "palm" && b.gesture === "index") || (b.gesture === "palm" && a.gesture === "index"),
      distanceVelocity,
      rotationVelocity,
      energy: clamp((Math.abs(distanceVelocity) + Math.abs(rotationVelocity) * 0.12 + a.speed + b.speed) / 3.2, 0, 2.5),
    };
  }
}
