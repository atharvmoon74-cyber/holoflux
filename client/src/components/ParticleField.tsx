/**
 * HOLOFLUX design reminder — Orbital Observatory: the live particle universe is the spectacle; rendering stays deep, physical, and restrained.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { ForceField, GestureFrame, HoloConfig, Metrics, ParticleFieldHandle, Vec2 } from "@/lib/holo-types";
import { DEFAULT_CONFIG } from "@/lib/presets";
import { detectInitialQuality, profileFor, type QualityProfile } from "@/lib/performance-profile";

type Props = {
  config: HoloConfig;
  gestureFrame: GestureFrame;
  gestureFrameRef: MutableRefObject<GestureFrame>;
  paused: boolean;
  audioEnergy: number;
  zoom: number;
  manualEvent: { id: number; type: "explosion" | "blackhole" | "vortex" | "galaxy"; position: Vec2 } | null;
  onMetrics: (metrics: Metrics) => void;
  onEvent: (message: string, tone?: "cyan" | "coral" | "violet") => void;
};

type Shockwave = { position: Vec2; born: number; strength: number };

const MAX_INTERACTIVE_PARTICLES = 25000;
const DEPTH_LAYER_COUNTS = [0.1, 0.34, 0.56] as const;
const SPECIES_MASSES = [0.72, 1.45, 0.36, 0.22, 2.2, 0.5, 1.12] as const;
const SPECIES_SIZES = [0.88, 0.58, 1.04, 0.46, 1.84, 0.92, 1.28] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function setTarget(targets: Float32Array, index: number, config: HoloConfig, total: number) {
  const t = index / total;
  const a = Math.PI * 2 * seeded(index, 0);
  const b = Math.acos(2 * seeded(index, 1) - 1);
  const r = Math.cbrt(seeded(index, 2)) * 3.3;
  let x = Math.sin(b) * Math.cos(a) * r;
  let y = Math.cos(b) * r;
  let z = Math.sin(b) * Math.sin(a) * r;
  const mode = config.formation;
  if (mode === "galaxy" || mode === "spiral") {
    const arm = (index % 3) * ((Math.PI * 2) / 3);
    const radius = Math.sqrt(seeded(index, 3)) * 4.2;
    const angle = arm + radius * 1.8 + seeded(index, 4) * 0.75;
    x = Math.cos(angle) * radius;
    y = (seeded(index, 5) - 0.5) * (0.2 + (4.2 - radius) * 0.09);
    z = Math.sin(angle) * radius;
  } else if (mode === "heart") {
    const u = a;
    const scale = 0.26;
    x = scale * 16 * Math.pow(Math.sin(u), 3);
    y = scale * (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
    z = (seeded(index, 8) - 0.5) * 0.42;
  } else if (mode === "dna") {
    const theta = t * Math.PI * 12;
    const strand = index % 2 === 0 ? 0 : Math.PI;
    x = Math.cos(theta + strand) * 1.7;
    y = (t - 0.5) * 6;
    z = Math.sin(theta + strand) * 1.7;
  } else if (mode === "cube") {
    const face = index % 6;
    const p = seeded(index, 10) * 4 - 2;
    const q = seeded(index, 11) * 4 - 2;
    if (face === 0) { x = -2; y = p; z = q; }
    if (face === 1) { x = 2; y = p; z = q; }
    if (face === 2) { x = p; y = -2; z = q; }
    if (face === 3) { x = p; y = 2; z = q; }
    if (face === 4) { x = p; y = q; z = -2; }
    if (face === 5) { x = p; y = q; z = 2; }
  } else if (mode === "torus" || mode === "saturn") {
    const major = mode === "saturn" ? 2.5 : 1.9;
    const minor = mode === "saturn" ? 0.36 : 0.7;
    const minorAngle = seeded(index, 12) * Math.PI * 2;
    const majorAngle = a;
    x = (major + minor * Math.cos(minorAngle)) * Math.cos(majorAngle);
    y = minor * Math.sin(minorAngle);
    z = (major + minor * Math.cos(minorAngle)) * Math.sin(majorAngle);
  } else if (mode === "infinity") {
    const u = a;
    x = 3.1 * Math.cos(u) / (1 + Math.sin(u) ** 2);
    y = 1.65 * Math.sin(u) * Math.cos(u) / (1 + Math.sin(u) ** 2);
    z = (seeded(index, 13) - 0.5) * 0.35;
  } else if (mode === "star") {
    const angle = a;
    const spikes = 5;
    const radius = 1.5 + Math.abs(Math.cos(angle * spikes)) * 2;
    x = Math.cos(angle) * radius * seeded(index, 14);
    y = Math.sin(angle) * radius * seeded(index, 14);
    z = (seeded(index, 15) - 0.5) * 0.6;
  } else if (mode === "wave") {
    x = (seeded(index, 16) - 0.5) * 7;
    z = (seeded(index, 17) - 0.5) * 5;
    y = Math.sin(x * 1.3 + z * 0.8) * 0.75;
  } else if (mode === "flower") {
    const petals = 6;
    const radius = (1.2 + Math.cos(a * petals) * 1.6) * seeded(index, 18);
    x = Math.cos(a) * radius;
    y = Math.sin(a) * radius;
    z = (seeded(index, 19) - 0.5) * 0.75;
  }
  targets[index * 3] = x;
  targets[index * 3 + 1] = y;
  targets[index * 3 + 2] = z;
}

function makeTextTargets(targets: Float32Array, text: string, total: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "white";
  context.font = "700 172px Space Grotesk, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText((text || "HOLO").slice(0, 10).toUpperCase(), canvas.width / 2, canvas.height / 2 + 8, 860);
  const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: Array<[number, number]> = [];
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      if (image[(y * canvas.width + x) * 4 + 3] > 120) points.push([x, y]);
    }
  }
  for (let i = 0; i < total; i += 1) {
    const point = points[Math.floor(seeded(i, 31) * points.length)] ?? [480, 160];
    targets[i * 3] = ((point[0] - canvas.width / 2) / canvas.width) * 8;
    targets[i * 3 + 1] = -((point[1] - canvas.height / 2) / canvas.height) * 3;
    targets[i * 3 + 2] = (seeded(i, 32) - 0.5) * 0.35;
  }
}

const vertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vDepth;
  uniform float uPixelRatio;
  uniform float uGlow;
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = clamp(1.0 - abs(mvPosition.z) / 18.0, 0.22, 1.0);
    gl_PointSize = aSize * uPixelRatio * (7.5 / -mvPosition.z) * (0.62 + uGlow * 0.38);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vDepth;
  uniform float uOpacity;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float soft = 1.0 - smoothstep(0.03, 0.5, d);
    float alpha = soft * uOpacity * vDepth;
    vec3 color = vColor * (1.0 + soft * 0.34);
    gl_FragColor = vec4(color, alpha);
  }
`;

const depthVertexShader = `
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uDrift;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * (0.06 + aSeed * 0.05) + aSeed * 71.0 + p.z) * uDrift;
    p.y += cos(uTime * (0.05 + aSeed * 0.04) + aSeed * 47.0 + p.x) * uDrift;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = clamp(1.0 - abs(mvPosition.z) / 40.0, 0.08, 1.0);
    vColor = mix(uColorA, uColorB, aSeed);
    vAlpha = depth * (0.35 + aSeed * 0.65);
    gl_PointSize = uSize * uPixelRatio * (15.0 + aSeed * 15.0) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const depthFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float soft = 1.0 - smoothstep(0.08, 0.5, d);
    gl_FragColor = vec4(vColor * (1.0 + soft * 0.25), soft * vAlpha * 0.62);
  }
`;

type DepthLayer = { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; points: THREE.Points; baseCount: number };

function createDepthLayer(count: number, radius: number, pointSize: number, colorA: THREE.Color, colorB: THREE.Color, pixelRatio: number): DepthLayer {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const angle = seeded(index, radius) * Math.PI * 2;
    const orbit = Math.pow(seeded(index, radius + 1), 0.42) * radius;
    const height = (seeded(index, radius + 2) - 0.5) * radius * 0.38;
    const ix = index * 3;
    positions[ix] = Math.cos(angle + orbit * 0.2) * orbit;
    positions[ix + 1] = height;
    positions[ix + 2] = Math.sin(angle + orbit * 0.2) * orbit - 8 - seeded(index, radius + 3) * 16;
    seeds[index] = seeded(index, radius + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setDrawRange(0, count);
  const material = new THREE.ShaderMaterial({
    vertexShader: depthVertexShader,
    fragmentShader: depthFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: pointSize },
      uColorA: { value: colorA.clone() },
      uColorB: { value: colorB.clone() },
      uDrift: { value: 0.12 },
    },
  });
  return { geometry, material, points: new THREE.Points(geometry, material), baseCount: count };
}

const ParticleField = forwardRef<ParticleFieldHandle, Props>(function ParticleField({ config, gestureFrame, gestureFrameRef, paused, audioEnergy, zoom, manualEvent, onMetrics, onEvent }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ParticleFieldHandle | null>(null);
  const configRef = useRef(config);
  const gesturesRef = gestureFrameRef;
  const pausedRef = useRef(paused);
  const audioRef = useRef(audioEnergy);
  const zoomRef = useRef(zoom);
  const manualRef = useRef(manualEvent);
  configRef.current = config;
  pausedRef.current = paused;
  audioRef.current = audioEnergy;
  zoomRef.current = zoom;
  manualRef.current = manualEvent;

  useImperativeHandle(ref, () => ({
    reset: () => handleRef.current?.reset(),
    focus: (position) => handleRef.current?.focus(position),
    getCanvas: () => handleRef.current?.getCanvas() ?? null,
    addExperiment: (field) => handleRef.current?.addExperiment(field),
    clearExperiments: () => handleRef.current?.clearExperiments(),
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let frame = 0;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    } catch {
      onEvent("WebGL is unavailable. Use a modern browser to render the particle field.", "coral");
      return undefined;
    }
    const hardwareProfile = profileFor(detectInitialQuality());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, hardwareProfile.maxPixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x02040b, 0);
    renderer.autoClear = true;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030711, 0.012);
    const camera = new THREE.PerspectiveCamera(44, mount.clientWidth / mount.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 10.6);
    const root = new THREE.Group();
    scene.add(root);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_INTERACTIVE_PARTICLES * 3);
    const velocities = new Float32Array(MAX_INTERACTIVE_PARTICLES * 3);
    const targets = new Float32Array(MAX_INTERACTIVE_PARTICLES * 3);
    const colors = new Float32Array(MAX_INTERACTIVE_PARTICLES * 3);
    const sizes = new Float32Array(MAX_INTERACTIVE_PARTICLES);
    const masses = new Float32Array(MAX_INTERACTIVE_PARTICLES);
    let previousFrameTime = performance.now();
    const cyan = new THREE.Color(config.visuals.colorA ?? "#79F3FF");
    const violet = new THREE.Color(config.visuals.colorB ?? "#9C7BFF");
    const color = new THREE.Color();
    const initialize = (activeCount: number, hard = false) => {
      const active = clamp(Math.round(activeCount), 800, MAX_INTERACTIVE_PARTICLES);
      if (configRef.current.formation === "text") makeTextTargets(targets, configRef.current.customText, active);
      for (let index = 0; index < active; index += 1) {
        if (configRef.current.formation !== "text") setTarget(targets, index, configRef.current, active);
        const ix = index * 3;
        if (hard || positions[ix] === 0 && positions[ix + 1] === 0 && positions[ix + 2] === 0) {
          positions[ix] = targets[ix] + (seeded(index, 41) - 0.5) * 3;
          positions[ix + 1] = targets[ix + 1] + (seeded(index, 42) - 0.5) * 3;
          positions[ix + 2] = targets[ix + 2] + (seeded(index, 43) - 0.5) * 3;
        }
        const hue = seeded(index, 44);
        const species = index % SPECIES_MASSES.length;
        color.copy(cyan).lerp(violet, hue);
        colors[ix] = color.r;
        colors[ix + 1] = color.g;
        colors[ix + 2] = color.b;
        sizes[index] = SPECIES_SIZES[species] * (0.78 + seeded(index, 45) * 0.92);
        masses[index] = SPECIES_MASSES[species];
      }
      geometry.setDrawRange(0, active);
    };
    initialize(configRef.current.particles.count, true);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() }, uGlow: { value: 0.9 }, uOpacity: { value: 0.92 } },
    });
    const particles = new THREE.Points(geometry, material);
    root.add(particles);
    const depthLayers = DEPTH_LAYER_COUNTS.map((ratio, index) => createDepthLayer(Math.max(1000, Math.round(hardwareProfile.depth * ratio)), 12 + index * 9, 0.16 + index * 0.12, cyan, violet, renderer.getPixelRatio()));
    depthLayers.forEach((layer) => root.add(layer.points));
    const trailCapacity = 1800;
    const trailPositions = new Float32Array(trailCapacity * 6);
    const trailColors = new Float32Array(trailCapacity * 6);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
    const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
    trails.frustumCulled = false;
    root.add(trails);
    const haloGeometry = new THREE.RingGeometry(0.6, 0.62, 128);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x79f3ff, transparent: true, opacity: 0.09, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.visible = false;
    root.add(halo);
    const shockwaveRingGeometry = new THREE.RingGeometry(0.94, 1, 96);
    const shockwaveRings = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(shockwaveRingGeometry, new THREE.MeshBasicMaterial({ color: 0xffb0a8, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      root.add(mesh);
      return mesh;
    });
    const forces: ForceField[] = [];
    const persistentForces: ForceField[] = [];
    const brushForces: ForceField[] = [];
    const lastBrushByHand = new Map<string, { position: Vec2; at: number }>();
    const shockwaves: Shockwave[] = [];
    let forceSeedActive = false;
    let lastTwoDistance = 0;
    let lastFormation = "";
    let lastText = "";
    let cameraScale = 1;
    let focusPoint = new THREE.Vector2(0, 0);
    let metricFrames = 0;
    let metricStart = performance.now();
    let adaptiveLevel: Metrics["adaptiveLevel"] = "cinematic";
    let qualityProfile: QualityProfile = profileFor(configRef.current.qualityTier);
    let desiredQualityScale = 1;
    let qualityScale = 1;
    let latestActiveForces = 0;
    let collisionTick = 0;
    let lastCollision = 0;
    let lastManualId = 0;
    let spawnCursor = 0;

    const addForce = (field: ForceField) => {
      const existing = forces.find((item) => item.id === field.id);
      if (existing) Object.assign(existing, field);
      else forces.push(field);
    };
    const emitShockwave = (position: Vec2, strength: number, event: string, tone: "cyan" | "coral" | "violet" = "coral") => {
      shockwaves.push({ position, strength, born: performance.now() });
      if (configRef.current.shockwave) onEvent(event, tone);
    };
    const seedParticlesAt = (position: Vec2, density: number, velocity: Vec2) => {
      const active = Math.max(1, geometry.drawRange.count);
      const originX = (position.x - 0.5) * 10;
      const originY = -(position.y - 0.5) * 6;
      const count = Math.round(18 + density * 96);
      for (let step = 0; step < count; step += 1) {
        const index = (spawnCursor + step) % active;
        const ix = index * 3;
        positions[ix] = originX + (seeded(index + step, 101) - 0.5) * 0.28;
        positions[ix + 1] = originY + (seeded(index + step, 102) - 0.5) * 0.28;
        positions[ix + 2] = (seeded(index + step, 103) - 0.5) * 0.4;
        velocities[ix] = velocity.x * 0.34;
        velocities[ix + 1] = -velocity.y * 0.28;
        velocities[ix + 2] = (seeded(index + step, 104) - 0.5) * 0.14;
        masses[index] = 0.3 + configRef.current.brush.mass * 2.1;
      }
      spawnCursor = (spawnCursor + count) % active;
    };
    const publishForces = () => {
      const frameData = gesturesRef.current;
      const currentConfig = configRef.current;
      const now = performance.now();
      const hands = frameData.hands;
      forces.length = 0;
      hands.forEach((hand) => {
        const action = currentConfig.interaction.gestureMap[hand.gesture] ?? "attract";
        const primaryPosition = hand.gesture === "palm" || hand.gesture === "fist" ? hand.palm : hand.predictedPosition;
        if (hand.gesture === "idle") return;
        let type: ForceField["type"] = "attract";
        if (action === "repel") type = "repel";
        if (action === "gravity") type = "gravity";
        if (action === "blackhole") type = "blackhole";
        if (action === "vortex") type = "vortex";
        if (action === "freeze") type = "freeze";
        if (action === "explosion") type = "explosion";
        if (hand.gesture === "palm" && currentConfig.interaction.gestureMap.palm === "repel") type = "repel";
        if (hand.gesture === "fist" && currentConfig.interaction.gestureMap.fist === "blackhole") type = "blackhole";
        const physicalMultiplier = type === "attract" ? currentConfig.physics.attraction : type === "repel" ? currentConfig.physics.repulsion : type === "gravity" ? currentConfig.physics.gravity * 2 : type === "blackhole" ? currentConfig.physics.blackHoleStrength : 1;
        const strength = (hand.gesture === "pinch" ? 1.7 : hand.gesture === "fist" ? 1.45 + Math.min(1, hand.duration / 1.8) : 0.92) * currentConfig.interaction.forceStrength * physicalMultiplier * hand.forceMultiplier;
        addForce({ id: hand.id, type, position: primaryPosition, strength, radius: currentConfig.interaction.radius * (hand.gesture === "fist" ? 1.6 : hand.gesture === "palm" ? 1.38 : 1), velocity: hand.velocity, rotation: hand.rotation, label: type.toUpperCase() });
        if (hand.isSwipe) addForce({ id: `${hand.id}-swipe`, type: "explosion", position: hand.predictedPosition, strength: Math.min(3.8, 0.85 * currentConfig.physics.explosionPower * hand.forceMultiplier), radius: clamp(0.1 + hand.speed * 0.045, 0.1, 0.28), velocity: hand.velocity, expiresAt: now + 120, label: "THROW" });
        if (hand.isCircular) addForce({ id: `${hand.id}-orbit`, type: "vortex", position: hand.predictedPosition, strength: Math.min(2.7, 0.9 * hand.forceMultiplier), radius: clamp(0.13 + hand.speed * 0.04, 0.13, 0.3), velocity: hand.velocity, rotation: hand.rotation, label: "MOTION VORTEX" });
        if (hand.pinchReleased) {
          addForce({ id: `${hand.id}-release`, type: "explosion", position: hand.predictedPosition, strength: Math.min(4.2, 1.35 * currentConfig.physics.explosionPower * hand.forceMultiplier), radius: clamp(0.14 + hand.speed * 0.055, 0.14, 0.34), velocity: hand.velocity, expiresAt: now + 160, label: "PINCH RELEASE" });
          emitShockwave(hand.predictedPosition, Math.min(2.2, hand.forceMultiplier), "PINCH RELEASE · ENERGY BURST", "coral");
        }
        if (hand.gesture === "pinch" && hand.speed > 0.08) {
          const previousBrush = lastBrushByHand.get(hand.id);
          const moved = previousBrush ? Math.hypot(previousBrush.position.x - hand.predictedPosition.x, previousBrush.position.y - hand.predictedPosition.y) : 1;
          if (moved > 0.014 || !previousBrush || now - previousBrush.at > 72) {
            const mode = currentConfig.brush.mode;
            const brushType: ForceField["type"] = mode === "erase" || mode === "repel" ? "repel" : mode === "freeze" ? "freeze" : mode === "spawn" ? "explosion" : mode === "draw" ? "vortex" : "attract";
            brushForces.push({ id: `brush-${hand.id}-${now.toFixed(0)}`, type: brushType, position: hand.predictedPosition, strength: 0.35 + currentConfig.brush.density * 0.95, radius: currentConfig.brush.size, velocity: hand.velocity, expiresAt: now + 260 + currentConfig.brush.lifetime * 1350, label: `BRUSH ${mode.toUpperCase()}` });
            if (mode === "spawn" || mode === "draw") seedParticlesAt(hand.predictedPosition, currentConfig.brush.density, hand.velocity);
            lastBrushByHand.set(hand.id, { position: hand.predictedPosition, at: now });
          }
        } else if (hand.gesture !== "pinch") lastBrushByHand.delete(hand.id);
      });
      const two = frameData.twoHands;
      if (two && hands.length >= 2) {
        const center = { x: (hands[0].palm.x + hands[1].palm.x) / 2, y: (hands[0].palm.y + hands[1].palm.y) / 2 };
        cameraScale = lerp(cameraScale, clamp(0.72 + two.distance * 1.25, 0.68, 1.6), 0.06);
        root.rotation.y = lerp(root.rotation.y, two.rotation * (0.34 + Math.min(0.34, Math.abs(two.rotationVelocity) * 0.03)), 0.03 + Math.min(0.08, Math.abs(two.rotationVelocity) * 0.008));
        if (two.bothOpen) {
          addForce({ id: "galaxy-seed", type: "vortex", position: center, strength: 0.64, radius: clamp(two.distance * 0.8, 0.16, 0.52), rotation: two.rotation, label: "GALAXY SEED" });
          if (!forceSeedActive && hands[0].duration > 1.05 && hands[1].duration > 1.05) {
            forceSeedActive = true;
            emitShockwave(center, 0.88, "GALAXY SEED CREATED", "violet");
          }
        } else forceSeedActive = false;
        if (two.tunnel) addForce({ id: "gravity-tunnel", type: "tunnel", position: center, strength: 1.15, radius: two.distance * 0.9, velocity: { x: hands[1].palm.x - hands[0].palm.x, y: hands[1].palm.y - hands[0].palm.y }, label: "GRAVITY TUNNEL" });
        if (two.bothPinched && lastTwoDistance > 0.1 && two.distance < 0.13 && two.distanceVelocity < -0.25 && now - lastCollision > 650) {
          lastCollision = now;
          const collisionEnergy = 1 + Math.min(2.1, two.energy);
          emitShockwave(center, 1.8 * currentConfig.physics.explosionPower * collisionEnergy, "FIELD COLLISION · ENERGY RELEASE", "coral");
          addForce({ id: "field-collision", type: "explosion", position: center, strength: 2.3 * currentConfig.physics.explosionPower * collisionEnergy, radius: 0.37 + Math.min(0.16, two.energy * 0.07), expiresAt: now + 180, label: "COLLISION" });
        }
        lastTwoDistance = two.distance;
      } else {
        forceSeedActive = false;
        lastTwoDistance = 0;
      }
      const manual = manualRef.current;
      if (manual && manual.id !== lastManualId) {
        lastManualId = manual.id;
        const type = manual.type === "explosion" ? "explosion" : manual.type === "blackhole" ? "blackhole" : "vortex";
        addForce({ id: `manual-${manual.id}`, type, position: manual.position, strength: manual.type === "explosion" ? 2.4 * currentConfig.physics.explosionPower : 1.8, radius: manual.type === "blackhole" ? 0.42 : 0.34, label: manual.type.toUpperCase() });
        emitShockwave(manual.position, manual.type === "explosion" ? 1.8 : 0.8, manual.type === "galaxy" ? "GALAXY FIELD DEPLOYED" : manual.type === "explosion" ? "SUPERNOVA IMPULSE" : `${manual.type.toUpperCase()} FIELD ACTIVE`, manual.type === "explosion" ? "coral" : "violet");
      }
      for (let index = persistentForces.length - 1; index >= 0; index -= 1) {
        const field = persistentForces[index];
        if (field.expiresAt && field.expiresAt < now) { persistentForces.splice(index, 1); continue; }
        addForce(field);
      }
      for (let index = brushForces.length - 1; index >= 0; index -= 1) {
        const field = brushForces[index];
        if (field.expiresAt && field.expiresAt < now) { brushForces.splice(index, 1); continue; }
        addForce(field);
      }
    };
    const resolveSampledCollisions = (count: number) => {
      if (configRef.current.collisionMode === "soft" || configRef.current.physics.collisionStrength < 0.05) return;
      const cell = 0.23;
      const buckets = new Map<string, number>();
      const sampleBudget = Math.max(650, Math.floor(6000 / qualityProfile.collisionStride));
      const stride = Math.max(1, Math.floor(count / sampleBudget));
      for (let i = 0; i < count; i += stride) {
        const ix = i * 3;
        const key = `${Math.floor(positions[ix] / cell)}:${Math.floor(positions[ix + 1] / cell)}:${Math.floor(positions[ix + 2] / cell)}`;
        const other = buckets.get(key);
        if (other === undefined) buckets.set(key, i);
        else {
          const ox = other * 3;
          const dx = positions[ix] - positions[ox];
          const dy = positions[ix + 1] - positions[ox + 1];
          const dz = positions[ix + 2] - positions[ox + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 0.00001 && d2 < cell * cell) {
            const inv = 1 / Math.sqrt(d2);
            const mode = configRef.current.collisionMode;
            const impulse = (mode === "explode" ? 0.026 : 0.006) * configRef.current.physics.collisionStrength * (configRef.current.collisionEnergy / 100);
            const sign = mode === "merge" ? -0.3 : 1;
            velocities[ix] += dx * inv * impulse * sign;
            velocities[ix + 1] += dy * inv * impulse * sign;
            velocities[ix + 2] += dz * inv * impulse * sign;
            velocities[ox] -= dz * inv * impulse * sign;
            if (mode === "explode" && configRef.current.fragmentation) {
              const scatter = impulse * 1.8;
              velocities[ix] += (seeded(i, 81) - 0.5) * scatter;
              velocities[ix + 1] += (seeded(i, 82) - 0.5) * scatter;
              velocities[ix + 2] += (seeded(i, 83) - 0.5) * scatter;
              velocities[ox] += (seeded(other, 84) - 0.5) * scatter;
              velocities[ox + 1] += (seeded(other, 85) - 0.5) * scatter;
              velocities[ox + 2] += (seeded(other, 86) - 0.5) * scatter;
            }
            velocities[ox + 1] -= dy * inv * impulse * sign;
            velocities[ox + 2] -= dz * inv * impulse * sign;
          }
        }
      }
    };
    const simulate = (delta: number) => {
      const currentConfig = configRef.current;
      cyan.set(currentConfig.visuals.colorA);
      violet.set(currentConfig.visuals.colorB);
      (scene.fog as THREE.FogExp2).density = 0.002 + currentConfig.visuals.fog * 0.018;
      renderer.setClearColor(0x02040b, 0.08 + currentConfig.visuals.backgroundIntensity * 0.32);
      qualityProfile = profileFor(currentConfig.qualityTier);
      qualityScale = lerp(qualityScale, desiredQualityScale, 0.045);
      const configuredInteractive = currentConfig.qualityTier === "custom" ? currentConfig.particles.count : qualityProfile.interactive;
      const active = clamp(Math.round(configuredInteractive * (0.58 + currentConfig.particles.density * 0.42) * qualityScale), 800, MAX_INTERACTIVE_PARTICLES);
      if (geometry.drawRange.count !== active) {
        geometry.setDrawRange(0, active);
        initialize(active);
      }
      if (lastFormation !== currentConfig.formation || lastText !== currentConfig.customText) {
        if (currentConfig.formation === "text") makeTextTargets(targets, currentConfig.customText, active);
        else for (let index = 0; index < active; index += 1) setTarget(targets, index, currentConfig, active);
        lastFormation = currentConfig.formation;
        lastText = currentConfig.customText;
      }
      publishForces();
      const now = performance.now();
      const activeForces = forces.filter((field) => !field.expiresAt || field.expiresAt > now);
      latestActiveForces = activeForces.length;
      const requestedDepth = Math.round(qualityProfile.depth * qualityScale);
      const depthBudget = Math.min(requestedDepth, hardwareProfile.depth);
      const depthCapacity = depthLayers.reduce((total, layer) => total + layer.baseCount, 0);
      depthLayers.forEach((layer) => {
        const layerTarget = Math.min(layer.baseCount, Math.round(depthBudget * (layer.baseCount / depthCapacity)));
        layer.geometry.setDrawRange(0, layerTarget);
        layer.material.uniforms.uTime.value = now * 0.001;
        layer.material.uniforms.uColorA.value.copy(cyan);
        layer.material.uniforms.uColorB.value.copy(violet);
        layer.material.uniforms.uDrift.value = 0.045 + currentConfig.motion.flow * 0.18 + currentConfig.visuals.depth * 0.08;
      });
      const physicsStep = delta * currentConfig.motion.speed * (currentConfig.reducedMotion ? 0.45 : 1);
      const rootAngle = now * 0.00016 * currentConfig.motion.rotation;
      root.rotation.z = lerp(root.rotation.z, rootAngle, 0.018);
      root.scale.setScalar(lerp(root.scale.x, cameraScale * zoomRef.current, 0.035));
      const cameraMode = currentConfig.camera.mode;
      if (Math.abs(camera.fov - currentConfig.camera.fov) > 0.05) { camera.fov = lerp(camera.fov, currentConfig.camera.fov, 0.12); camera.updateProjectionMatrix(); }
      const targetDistance = cameraMode === "macro" ? 5.4 : cameraMode === "deepSpace" ? 17.6 : 10.6;
      camera.position.z = lerp(camera.position.z, targetDistance, 0.035);
      for (let index = 0; index < active; index += 1) {
        const ix = index * 3;
        const px = positions[ix]; const py = positions[ix + 1]; const pz = positions[ix + 2];
        let vx = velocities[ix]; let vy = velocities[ix + 1]; let vz = velocities[ix + 2];
        const particleMass = Math.max(0.18, masses[index] || 1);
        const toTargetX = targets[ix] - px;
        const toTargetY = targets[ix + 1] - py;
        const toTargetZ = targets[ix + 2] - pz;
        const morph = (currentConfig.mode === "quantum" ? 0.004 : currentConfig.mode === "fluid" ? 0.0032 : 0.007) * (1.05 - currentConfig.particles.randomness * 0.4);
        vx += toTargetX * morph * physicsStep;
        vy += toTargetY * morph * physicsStep;
        vz += toTargetZ * morph * physicsStep;
        const noise = currentConfig.motion.noise * (0.35 + currentConfig.physics.turbulence) * (0.55 + currentConfig.particles.randomness * 0.9) * 0.00055;
        vx += Math.sin(now * 0.0012 + index * 0.17 + pz) * noise;
        vy += Math.cos(now * 0.0009 + index * 0.09 + px) * noise + Math.sin(now * 0.0006 + pz) * currentConfig.motion.flow * 0.00035;
        vz += Math.sin(now * 0.0007 + index * 0.13 + py) * noise;
        const radial = Math.sqrt(px * px + py * py) + 0.01;
        if (currentConfig.mode === "blackhole") {
          vx += (-px / radial) * 0.0019;
          vy += (-py / radial) * 0.0019;
          vx += (-py / radial) * 0.0025;
          vy += (px / radial) * 0.0025;
        }
        if (currentConfig.mode === "vortex") {
          vx += (-py / radial) * 0.0021 * currentConfig.motion.orbitalSpeed;
          vy += (px / radial) * 0.0021 * currentConfig.motion.orbitalSpeed;
        }
        if (currentConfig.mode === "supernova") {
          const pulse = 0.00075 + Math.sin(now * 0.002 + index * 0.013) * 0.00035;
          vx += (px / radial) * pulse;
          vy += (py / radial) * pulse;
        }
        if (currentConfig.mode === "magnetic") {
          vy += Math.sin(px * 2.1 + now * 0.001) * 0.0014;
          vx += Math.cos(py * 1.7 + now * 0.001) * 0.0008;
        }
        activeForces.forEach((field) => {
          const fx = (field.position.x - 0.5) * 10;
          const fy = -(field.position.y - 0.5) * 6;
          const dx = fx - px; const dy = fy - py; const dz = -pz * 0.45;
          const d2 = dx * dx + dy * dy + dz * dz + 0.04;
          const d = Math.sqrt(d2);
          const radius = Math.max(0.2, field.radius * 10);
          if (d > radius && field.type !== "tunnel") return;
          const falloff = Math.pow(clamp(1 - d / radius, 0, 1), 1.25) * field.strength * currentConfig.interaction.forceStrength / particleMass;
          if (field.type === "attract" || field.type === "gravity") { vx += (dx / d) * falloff * 0.082; vy += (dy / d) * falloff * 0.082; vz += (dz / d) * falloff * 0.046; }
          if (field.type === "repel" || field.type === "explosion") { vx -= (dx / d) * falloff * (field.type === "explosion" ? 0.34 : 0.15); vy -= (dy / d) * falloff * (field.type === "explosion" ? 0.34 : 0.15); vz -= (dz / d) * falloff * 0.09; }
          if (field.type === "blackhole" || field.type === "vortex") {
            const pull = field.type === "blackhole" ? 0.15 : 0.045;
            const orbital = 0.09 * (field.type === "vortex" ? currentConfig.motion.orbitalSpeed : 1);
            vx += (dx / d) * falloff * pull + (-dy / d) * falloff * orbital;
            vy += (dy / d) * falloff * pull + (dx / d) * falloff * orbital;
            vz += (dz / d) * falloff * 0.05;
          }
          if (field.type === "freeze") { vx *= 0.88; vy *= 0.88; vz *= 0.88; }
          if (field.type === "tunnel" && field.velocity) {
            const tx = field.velocity.x * 9; const ty = -field.velocity.y * 6;
            const segmentLen2 = tx * tx + ty * ty + 0.001;
            const projection = clamp(((px - (fx - tx / 2)) * tx + (py - (fy - ty / 2)) * ty) / segmentLen2, 0, 1);
            const nearestX = fx - tx / 2 + tx * projection; const nearestY = fy - ty / 2 + ty * projection;
            vx += (nearestX - px) * 0.011 * field.strength;
            vy += (nearestY - py) * 0.011 * field.strength;
          }
        });
        shockwaves.forEach((wave) => {
          const age = (now - wave.born) / 900;
          if (age >= 1) return;
          const wx = (wave.position.x - 0.5) * 10; const wy = -(wave.position.y - 0.5) * 6;
          const dx = px - wx; const dy = py - wy; const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          const ring = Math.abs(d - age * 5.6);
          if (ring < 0.34) { const punch = (1 - ring / 0.34) * wave.strength * 0.13; vx += dx / d * punch; vy += dy / d * punch; }
        });
        const damping = Math.max(0.82, 1 - (currentConfig.physics.drag * 0.036 + currentConfig.physics.viscosity * 0.018 / particleMass + (1 - currentConfig.particles.lifetime) * 0.012));
        velocities[ix] = vx * damping;
        velocities[ix + 1] = vy * damping;
        velocities[ix + 2] = vz * damping;
        positions[ix] += velocities[ix] * physicsStep;
        positions[ix + 1] += velocities[ix + 1] * physicsStep;
        positions[ix + 2] += velocities[ix + 2] * physicsStep;
        const speed = Math.min(2, Math.hypot(vx, vy, vz) * 7);
        if (currentConfig.visuals.colorStyle === "velocity") color.setHSL(0.53 - speed * 0.19, 0.82, 0.56 + speed * 0.12);
        else if (currentConfig.visuals.colorStyle === "rainbow") color.setHSL((index / active + now * 0.000025) % 1, 0.78, 0.64);
        else if (currentConfig.visuals.colorStyle === "random") color.setHSL(seeded(index, 59), 0.76, 0.62);
        else color.copy(cyan).lerp(violet, clamp(index / active * 0.42 + speed * 0.25, 0, 1));
        colors[ix] = color.r; colors[ix + 1] = color.g; colors[ix + 2] = color.b;
        const trailCharacter = currentConfig.visuals.trails ? 1 + currentConfig.particles.trailLength * 0.24 : 1;
        sizes[index] = (0.62 + seeded(index, 60) * 1.8 + speed * 0.85 + audioRef.current * 1.8) * currentConfig.particles.size * trailCharacter;
      }
      const trailCount = currentConfig.visuals.trails ? Math.min(trailCapacity, Math.max(180, Math.floor(active / 7))) : 0;
      if (trailCount) {
        const stride = Math.max(1, Math.floor(active / trailCount));
        for (let trailIndex = 0; trailIndex < trailCount; trailIndex += 1) {
          const particleIndex = Math.min(active - 1, trailIndex * stride);
          const particleOffset = particleIndex * 3;
          const trailOffset = trailIndex * 6;
          const speed = Math.hypot(velocities[particleOffset], velocities[particleOffset + 1], velocities[particleOffset + 2]);
          const length = (0.04 + Math.min(0.54, speed * 1.15)) * currentConfig.particles.trailLength;
          trailPositions[trailOffset] = positions[particleOffset];
          trailPositions[trailOffset + 1] = positions[particleOffset + 1];
          trailPositions[trailOffset + 2] = positions[particleOffset + 2];
          trailPositions[trailOffset + 3] = positions[particleOffset] - velocities[particleOffset] * length;
          trailPositions[trailOffset + 4] = positions[particleOffset + 1] - velocities[particleOffset + 1] * length;
          trailPositions[trailOffset + 5] = positions[particleOffset + 2] - velocities[particleOffset + 2] * length;
          trailColors[trailOffset] = colors[particleOffset];
          trailColors[trailOffset + 1] = colors[particleOffset + 1];
          trailColors[trailOffset + 2] = colors[particleOffset + 2];
          trailColors[trailOffset + 3] = colors[particleOffset] * 0.08;
          trailColors[trailOffset + 4] = colors[particleOffset + 1] * 0.08;
          trailColors[trailOffset + 5] = colors[particleOffset + 2] * 0.08;
        }
        (trailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        (trailGeometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      }
      trailGeometry.setDrawRange(0, trailCount * 2);
      trailMaterial.opacity = currentConfig.visuals.trails ? 0.16 + currentConfig.particles.trailLength * 0.34 : 0;
      collisionTick += 1;
      if (collisionTick % Math.max(2, qualityProfile.collisionStride) === 0) resolveSampledCollisions(active);
      for (let i = shockwaves.length - 1; i >= 0; i -= 1) if (now - shockwaves[i].born > 900) shockwaves.splice(i, 1);
      shockwaveRings.forEach((ring, index) => {
        const wave = shockwaves[index];
        if (!wave) { ring.visible = false; return; }
        const age = clamp((now - wave.born) / 900, 0, 1);
        ring.visible = true;
        ring.position.set((wave.position.x - 0.5) * 10, -(wave.position.y - 0.5) * 6, 0.2);
        ring.scale.setScalar(0.12 + age * (2.8 + wave.strength * 1.3));
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - age) * 0.3;
        (ring.material as THREE.MeshBasicMaterial).color.set(wave.strength > 1.4 ? 0xff8d86 : 0x79f3ff);
      });
      const primary = gesturesRef.current.hands[0];
      if (primary) {
        halo.visible = true;
        halo.position.set((primary.position.x - 0.5) * 10, -(primary.position.y - 0.5) * 6, 0.15);
        halo.scale.setScalar((primary.gesture === "fist" ? 2.3 : primary.gesture === "palm" ? 1.65 : 1) * currentConfig.interaction.radius * 2.3);
        (halo.material as THREE.MeshBasicMaterial).color.set(primary.gesture === "palm" ? 0xff8d86 : primary.gesture === "fist" ? 0xaf8dff : 0x79f3ff);
      } else halo.visible = false;
      if (cameraMode === "followHand" && primary) focusPoint.set((primary.predictedPosition.x - 0.5) * 2, -(primary.predictedPosition.y - 0.5) * 1.25);
      else if (cameraMode === "orbit" || cameraMode === "cinematic") focusPoint.set(Math.sin(now * 0.00018) * currentConfig.camera.drift * 1.8, Math.cos(now * 0.00013) * currentConfig.camera.drift * 0.92);
      else if (cameraMode === "followEvent" && shockwaves[0]) focusPoint.set((shockwaves[0].position.x - 0.5) * 1.8, -(shockwaves[0].position.y - 0.5) * 1.08);
      else focusPoint.lerp(new THREE.Vector2(0, 0), 0.01);
      camera.position.x = lerp(camera.position.x, focusPoint.x, 0.02);
      camera.position.y = lerp(camera.position.y, focusPoint.y, 0.02);
      camera.lookAt(0, 0, 0);
      material.uniforms.uGlow.value = currentConfig.visuals.glow * (0.58 + currentConfig.visuals.bloom * 0.42);
      material.uniforms.uOpacity.value = currentConfig.particles.opacity;
      (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute("aColor") as THREE.BufferAttribute).needsUpdate = true;
      (geometry.getAttribute("aSize") as THREE.BufferAttribute).needsUpdate = true;
    };
    const resize = () => {
      const width = mount.clientWidth; const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      depthLayers.forEach((layer) => { layer.material.uniforms.uPixelRatio.value = renderer.getPixelRatio(); });
    };
    const loop = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min((now - previousFrameTime) / 1000, 0.045);
      previousFrameTime = now;
      if (!pausedRef.current) simulate(delta);
      renderer.render(scene, camera);
      metricFrames += 1;
      const metricsNow = performance.now();
      if (metricsNow - metricStart > 620) {
        const fps = Math.round((metricFrames * 1000) / (metricsNow - metricStart));
        if (configRef.current.performanceMode || fps < 32) { adaptiveLevel = "performance"; desiredQualityScale = Math.max(0.38, desiredQualityScale * 0.78); }
        else if (fps < 47) { adaptiveLevel = "balanced"; desiredQualityScale = Math.max(0.58, desiredQualityScale * 0.9); }
        else { adaptiveLevel = "cinematic"; desiredQualityScale = Math.min(1, desiredQualityScale + 0.035); }
        const depthRendered = depthLayers.reduce((total, layer) => total + layer.geometry.drawRange.count, 0);
        onMetrics({ fps, frameTime: +(1000 / Math.max(fps, 1)).toFixed(1), particleCount: geometry.drawRange.count + depthRendered, trackingLatency: 0, adaptiveLevel, qualityTier: configRef.current.qualityTier, targetParticles: (configRef.current.qualityTier === "custom" ? configRef.current.particles.count : qualityProfile.interactive) + Math.min(qualityProfile.depth, hardwareProfile.depth), activeForces: latestActiveForces, trackingFps: 0, renderMode: depthRendered ? "gpu-layered" : "gpu-safe" });
        metricFrames = 0; metricStart = metricsNow;
      }
      frame = requestAnimationFrame(loop);
    };
    handleRef.current = {
      reset: () => {
        for (let index = 0; index < geometry.drawRange.count; index += 1) {
          const ix = index * 3;
          positions[ix] = targets[ix] + (seeded(index, 91) - 0.5) * 1.2;
          positions[ix + 1] = targets[ix + 1] + (seeded(index, 92) - 0.5) * 1.2;
          positions[ix + 2] = targets[ix + 2] + (seeded(index, 93) - 0.5) * 1.2;
          velocities[ix] = velocities[ix + 1] = velocities[ix + 2] = 0;
        }
        emitShockwave({ x: 0.5, y: 0.5 }, 0.78, "FIELD RECALIBRATED", "cyan");
      },
      focus: (position) => { focusPoint.set((position.x - 0.5) * 0.6, -(position.y - 0.5) * 0.36); },
      getCanvas: () => renderer.domElement,
      addExperiment: (field) => {
        persistentForces.push({ ...field, id: `experiment-${performance.now().toFixed(2)}-${persistentForces.length}` });
        emitShockwave(field.position, Math.min(1.2, field.strength), `${(field.label ?? field.type).toUpperCase()} EXPERIMENT DEPLOYED`, "violet");
      },
      clearExperiments: () => { persistentForces.length = 0; onEvent("EXPERIMENT FIELDS CLEARED", "cyan"); },
    };
    window.addEventListener("resize", resize);
    resize();
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose(); material.dispose(); haloGeometry.dispose(); haloMaterial.dispose(); shockwaveRingGeometry.dispose(); shockwaveRings.forEach((ring) => (ring.material as THREE.Material).dispose()); trailGeometry.dispose(); trailMaterial.dispose(); depthLayers.forEach((layer) => { layer.geometry.dispose(); layer.material.dispose(); }); renderer.dispose();
      renderer.domElement.remove();
      handleRef.current = null;
    };
  }, [onEvent, onMetrics]);

  return <div ref={mountRef} className="particle-field" aria-label="Live HOLOFLUX particle simulation" />;
});

export default ParticleField;
