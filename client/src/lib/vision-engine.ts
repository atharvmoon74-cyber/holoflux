/**
 * HOLOFLUX design reminder — Orbital Observatory: camera input remains local, intentionally throttled, and gracefully optional.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export type RawVisionHand = { landmarks: Array<{ x: number; y: number; z: number }>; handedness: "Left" | "Right" | "Unknown"; score: number };

export class VisionEngine {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private lastInference = 0;
  private running = false;

  constructor(
    private onFrame: (hands: RawVisionHand[], inferenceMs: number) => void,
    private onStatus: (status: "initializing" | "active" | "lost" | "error", message?: string) => void,
  ) {}

  async start(): Promise<MediaStream> {
    this.onStatus("initializing");
    try {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.52,
        minHandPresenceConfidence: 0.48,
        minTrackingConfidence: 0.48,
      });
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" }, audio: false });
      this.video = document.createElement("video");
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      this.onStatus("active");
      this.detect();
      return this.stream;
    } catch (error) {
      this.onStatus("error", error instanceof Error ? error.message : "Camera access could not be started.");
      this.stop();
      throw error;
    }
  }

  getStream() { return this.stream; }

  private detect = () => {
    if (!this.running || !this.video || !this.landmarker) return;
    const now = performance.now();
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime && now - this.lastInference > 28) {
      this.lastVideoTime = this.video.currentTime;
      this.lastInference = now;
      const started = performance.now();
      const result = this.landmarker.detectForVideo(this.video, now);
      const hands: RawVisionHand[] = result.landmarks.map((landmarks, index) => ({
        landmarks,
        handedness: (result.handednesses[index]?.[0]?.categoryName as RawVisionHand["handedness"]) ?? "Unknown",
        score: result.handednesses[index]?.[0]?.score ?? 0,
      }));
      this.onFrame(hands, performance.now() - started);
      if (!hands.length) this.onStatus("lost");
      else this.onStatus("active");
    }
    this.raf = requestAnimationFrame(this.detect);
  };

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
  }
}
