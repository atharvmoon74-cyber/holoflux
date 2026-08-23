/**
 * HOLOFLUX design reminder — Orbital Observatory: the live particle universe is the spectacle; rendering stays deep, physical, and restrained.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { ForceField, GestureFrame, HoloConfig, Metrics, ParticleFieldHandle, Vec2 } from "@/lib/holo-types";
import { DEFAULT_CONFIG } from "@/lib/presets";

type Props = {
  config: HoloConfig;
  gestureFrame: GestureFrame;
  paused: boolean;
  audioEnergy: number;
  zoom: number;
  manualEvent: { id: number; type: "explosion" | "blackhole" | "vortex" | "galaxy"; position: Vec2 } | null;
  onMetrics: (metrics: Metrics) => void;
  onEvent: (message: string, tone?: "cyan" | "coral" | "violet") => void;
};

type Shockwave = { position: Vec2; born: number; strength: number };

const MAX_PARTICLES = 14000;
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

const ParticleField = forwardRef<ParticleFieldHandle, Props>(function ParticleField({ config, gestureFrame, paused, audioEnergy, zoom, manualEvent, onMetrics, onEvent }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ParticleFieldHandle | null>(null);
  const configRef = useRef(config);
  const gesturesRef = useRef(gestureFrame);
  const pausedRef = useRef(paused);
  const audioRef = useRef(audioEnergy);
  const zoomRef = useRef(zoom);
  const manualRef = useRef(manualEvent);
  configRef.current = config;
  gesturesRef.current = gestureFrame;
  pausedRef.current = paused;
  audioRef.current = audioEnergy;
  zoomRef.current = zoom;
  manualRef.current = manualEvent;

  useImperativeHandle(ref, () => ({
    reset: () => handleRef.current?.reset(),
    focus: (position) => handleRef.current?.focus(position),
    getCanvas: () => handleRef.current?.getCanvas() ?? null,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const velocities = new Float32Array(MAX_PARTICLES * 3);
    const targets = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    let previousFrameTime = performance.now();
    const cyan = new THREE.Color(config.visuals.colorA ?? "#79F3FF");
    const violet = new THREE.Color(config.visuals.colorB ?? "#9C7BFF");
    const color = new THREE.Color();
    const initialize = (activeCount: number, hard = false) => {
      const active = clamp(Math.round(activeCount), 800, MAX_PARTICLES);
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
        color.copy(cyan).lerp(violet, hue);
        colors[ix] = color.r;
        colors[ix + 1] = color.g;
        colors[ix + 2] = color.b;
        sizes[index] = 0.72 + seeded(index, 45) * 1.75;
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
    const haloGeometry = new THREE.RingGeometry(0.6, 0.62, 128);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x79f3ff, transparent: true, opacity: 0.09, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.visible = false;
    root.add(halo);
    const forces: ForceField[] = [];
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
    let collisionTick = 0;
    let lastCollision = 0;
    let lastManualId = 0;

    const addForce = (field: ForceField) => {
      const existing = forces.find((item) => item.id === field.id);
      if (existing) Object.assign(existing, field);
      else forces.push(field);
    };
    const emitShockwave = (position: Vec2, strength: number, event: string, tone: "cyan" | "coral" | "violet" = "coral") => {
      shockwaves.push({ position, strength, born: performance.now() });
      if (configRef.current.shockwave) onEvent(event, tone);
    };
    const publishForces = () => {
      const frameData = gesturesRef.current;
      const currentConfig = configRef.current;
      const now = performance.now();
      const hands = frameData.hands;
      forces.length = 0;
      hands.forEach((hand) => {
        const action = currentConfig.interaction.gestureMap[hand.gesture] ?? "attract";
        const primaryPosition = hand.gesture === "palm" || hand.gesture === "fist" ? hand.palm : hand.position;
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
        const strength = (hand.gesture === "pinch" ? 1.7 : hand.gesture === "fist" ? 1.45 + Math.min(1, hand.duration / 1.8) : 0.92) * currentConfig.interaction.forceStrength * physicalMultiplier;
        addForce({ id: hand.id, type, position: primaryPosition, strength, radius: currentConfig.interaction.radius * (hand.gesture === "fist" ? 1.6 : hand.gesture === "palm" ? 1.38 : 1), velocity: hand.velocity, rotation: hand.rotation, label: type.toUpperCase() });
        if (hand.isSwipe) addForce({ id: `${hand.id}-swipe`, type: "explosion", position: hand.position, strength: 0.85 * currentConfig.physics.explosionPower, radius: 0.12, velocity: hand.velocity, expiresAt: now + 120, label: "THROW" });
      });
      const two = frameData.twoHands;
      if (two && hands.length >= 2) {
        const center = { x: (hands[0].palm.x + hands[1].palm.x) / 2, y: (hands[0].palm.y + hands[1].palm.y) / 2 };
        cameraScale = lerp(cameraScale, clamp(0.72 + two.distance * 1.25, 0.68, 1.6), 0.06);
        root.rotation.y = lerp(root.rotation.y, two.rotation * 0.34, 0.03);
        if (two.bothOpen) {
          addForce({ id: "galaxy-seed", type: "vortex", position: center, strength: 0.64, radius: clamp(two.distance * 0.8, 0.16, 0.52), rotation: two.rotation, label: "GALAXY SEED" });
          if (!forceSeedActive && hands[0].duration > 1.05 && hands[1].duration > 1.05) {
            forceSeedActive = true;
            emitShockwave(center, 0.88, "GALAXY SEED CREATED", "violet");
          }
        } else forceSeedActive = false;
        if (two.tunnel) addForce({ id: "gravity-tunnel", type: "tunnel", position: center, strength: 1.15, radius: two.distance * 0.9, velocity: { x: hands[1].palm.x - hands[0].palm.x, y: hands[1].palm.y - hands[0].palm.y }, label: "GRAVITY TUNNEL" });
        if (two.bothPinched && lastTwoDistance > 0.1 && two.distance < 0.13 && now - lastCollision > 900) {
          lastCollision = now;
          emitShockwave(center, 1.8 * currentConfig.physics.explosionPower, "FIELD COLLISION · ENERGY RELEASE", "coral");
          addForce({ id: "field-collision", type: "explosion", position: center, strength: 2.3 * currentConfig.physics.explosionPower, radius: 0.37, expiresAt: now + 180, label: "COLLISION" });
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
    };
    const resolveSampledCollisions = (count: number) => {
      if (configRef.current.collisionMode === "soft" || configRef.current.physics.collisionStrength < 0.05) return;
      const cell = 0.23;
      const buckets = new Map<string, number>();
      const stride = Math.max(1, Math.floor(count / 1550));
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
            velocities[ox] -= dx * inv * impulse * sign;
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
      const active = clamp(Math.round(currentConfig.particles.count * (0.45 + currentConfig.particles.density * 0.55) * (adaptiveLevel === "performance" ? 0.48 : adaptiveLevel === "balanced" ? 0.72 : 1)), 800, MAX_PARTICLES);
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
      const physicsStep = delta * currentConfig.motion.speed * (currentConfig.reducedMotion ? 0.45 : 1);
      const rootAngle = now * 0.00016 * currentConfig.motion.rotation;
      root.rotation.z = lerp(root.rotation.z, rootAngle, 0.018);
      root.scale.setScalar(lerp(root.scale.x, cameraScale * zoomRef.current, 0.035));
      for (let index = 0; index < active; index += 1) {
        const ix = index * 3;
        const px = positions[ix]; const py = positions[ix + 1]; const pz = positions[ix + 2];
        let vx = velocities[ix]; let vy = velocities[ix + 1]; let vz = velocities[ix + 2];
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
          const falloff = Math.pow(clamp(1 - d / radius, 0, 1), 1.25) * field.strength * currentConfig.interaction.forceStrength;
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
        const damping = Math.max(0.82, 1 - (currentConfig.physics.drag * 0.036 + currentConfig.physics.viscosity * 0.018 + (1 - currentConfig.particles.lifetime) * 0.012));
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
      collisionTick += 1;
      if (collisionTick % 3 === 0) resolveSampledCollisions(active);
      for (let i = shockwaves.length - 1; i >= 0; i -= 1) if (now - shockwaves[i].born > 900) shockwaves.splice(i, 1);
      const primary = gesturesRef.current.hands[0];
      if (primary) {
        halo.visible = true;
        halo.position.set((primary.position.x - 0.5) * 10, -(primary.position.y - 0.5) * 6, 0.15);
        halo.scale.setScalar((primary.gesture === "fist" ? 2.3 : primary.gesture === "palm" ? 1.65 : 1) * currentConfig.interaction.radius * 2.3);
        (halo.material as THREE.MeshBasicMaterial).color.set(primary.gesture === "palm" ? 0xff8d86 : primary.gesture === "fist" ? 0xaf8dff : 0x79f3ff);
      } else halo.visible = false;
      focusPoint.lerp(new THREE.Vector2(0, 0), 0.01);
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
        if (configRef.current.performanceMode || fps < 32) adaptiveLevel = "performance";
        else if (fps < 47) adaptiveLevel = "balanced";
        else adaptiveLevel = "cinematic";
        onMetrics({ fps, frameTime: +(1000 / Math.max(fps, 1)).toFixed(1), particleCount: geometry.drawRange.count, trackingLatency: 0, adaptiveLevel });
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
    };
    window.addEventListener("resize", resize);
    resize();
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose(); material.dispose(); haloGeometry.dispose(); haloMaterial.dispose(); renderer.dispose();
      renderer.domElement.remove();
      handleRef.current = null;
    };
  }, [onEvent, onMetrics]);

  return <div ref={mountRef} className="particle-field" aria-label="Live HOLOFLUX particle simulation" />;
});

export default ParticleField;
