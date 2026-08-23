/**
 * HOLOFLUX design reminder — Orbital Observatory: optional audio sensing is explicitly opted into and never produces audible playback.
 */
export class AudioReactiveEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private data: Uint8Array | null = null;

  async start() {
    if (this.context) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.context = new AudioContext();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    source.connect(this.analyser);
  }

  sample() {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteFrequencyData(this.data);
    const bins = Math.max(1, Math.floor(this.data.length * 0.18));
    let sum = 0;
    for (let index = 0; index < bins; index += 1) sum += this.data[index];
    return sum / bins / 255;
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context?.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.data = null;
  }
}
